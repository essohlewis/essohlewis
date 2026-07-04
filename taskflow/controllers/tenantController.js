const pool = require('../config/db');
const { createAndSendNotification } = require('./notificationController');

// Helper : get role in a tenant
async function getTenantMemberRole(tenantId, userId) {
  const [rows] = await pool.query(
    'SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?',
    [tenantId, userId]
  );
  return rows.length > 0 ? rows[0].role : null;
}

// Helper : check tenant details
async function getTenantDetails(tenantId) {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  return rows.length > 0 ? rows[0] : null;
}

// ================= TENANTS / ORGANISATIONS =================

// Créer un tenant (organisation)
exports.createTenant = async (req, res, next) => {
  const { name, slug } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Le nom de l'organisation est requis." });
  }

  if (!slug || !slug.trim()) {
    return res.status(400).json({ message: "Le slug de l'organisation est requis." });
  }

  // Valider le format du slug (lettres minuscules, chiffres, tirets uniquement)
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug.trim())) {
    return res.status(400).json({ message: "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Vérifier si le slug existe déjà
    const [existing] = await conn.query('SELECT id FROM tenants WHERE slug = ?', [slug.trim()]);
    if (existing.length > 0) {
      // Annuler la transaction ouverte ; la connexion est rendue au pool par le
      // bloc finally. Ne PAS appeler conn.release() ici : cela provoquerait une
      // double libération de la même connexion (le finally la libère déjà).
      await conn.rollback();
      return res.status(409).json({ message: "Ce slug d'organisation est déjà utilisé." });
    }

    // 2. Insérer le tenant
    const [tResult] = await conn.query(
      'INSERT INTO tenants (name, slug, plan) VALUES (?, ?, ?)',
      [name.trim(), slug.trim(), 'free']
    );
    const tenantId = tResult.insertId;

    // 3. Associer le créateur en tant que propriétaire ('owner')
    await conn.query(
      'INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)',
      [tenantId, req.userId, 'owner']
    );

    await conn.commit();
    res.status(201).json({ id: tenantId, name: name.trim(), slug: slug.trim(), plan: 'free', role: 'owner' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// Lister tous les tenants de l'utilisateur connecté
exports.getTenants = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.name, t.slug, t.plan, t.created_at, tm.role 
       FROM tenants t 
       JOIN tenant_members tm ON t.id = tm.tenant_id 
       WHERE tm.user_id = ? 
       ORDER BY t.name ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ================= MEMBRES DES TENANTS =================

// Lister les membres d'une organisation
exports.getTenantMembers = async (req, res, next) => {
  const tenantId = req.params.id;
  try {
    // Vérifier si l'utilisateur demandeur appartient à l'organisation
    const myRole = await getTenantMemberRole(tenantId, req.userId);
    if (!myRole) {
      return res.status(403).json({ message: "Accès refusé aux membres de cette organisation." });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar IS NOT NULL as has_avatar, tm.role 
       FROM users u 
       JOIN tenant_members tm ON u.id = tm.user_id 
       WHERE tm.tenant_id = ? 
       ORDER BY tm.role DESC, u.name ASC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// Ajouter/Inviter un membre dans l'organisation par email
exports.addTenantMember = async (req, res, next) => {
  const tenantId = req.params.id;
  const { email, role } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ message: "L'email de l'utilisateur est obligatoire." });
  }

  const targetRole = role && ['admin', 'member'].includes(role) ? role : 'member';

  try {
    // 1. Vérifier si l'organisation existe
    const tenant = await getTenantDetails(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Organisation introuvable." });
    }

    // 2. Vérifier les privilèges de l'invitant (owner ou admin requis)
    const myRole = await getTenantMemberRole(tenantId, req.userId);
    if (myRole !== 'owner' && myRole !== 'admin') {
      return res.status(403).json({ message: "Privilèges insuffisants pour inviter des membres dans cette organisation." });
    }

    // 3. Trouver le destinataire par email
    const [uRows] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email.trim()]);
    if (uRows.length === 0) {
      return res.status(404).json({ message: "Aucun utilisateur inscrit avec cet email." });
    }
    const inviteeId = uRows[0].id;
    const inviteeName = uRows[0].name;

    // 4. Vérifier s'il est déjà membre
    const existingRole = await getTenantMemberRole(tenantId, inviteeId);
    if (existingRole) {
      return res.status(400).json({ message: "Cet utilisateur est déjà membre de cette organisation." });
    }

    // 5. Insérer le membre
    await pool.query(
      'INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (?, ?, ?)',
      [tenantId, inviteeId, targetRole]
    );

    // 6. Envoyer une notification en temps réel au destinataire
    try {
      await createAndSendNotification(
        inviteeId,
        'share',
        `Vous avez été invité à rejoindre l'organisation "${tenant.name}".`
      );
    } catch (notifErr) {
      console.error("Erreur d'envoi de la notification d'invitation de l'organisation :", notifErr);
    }

    res.status(201).json({ id: inviteeId, name: inviteeName, email: email.trim(), role: targetRole });
  } catch (err) {
    next(err);
  }
};

// Retirer un membre de l'organisation
exports.removeTenantMember = async (req, res, next) => {
  const tenantId = req.params.id;
  const targetMemberId = req.params.userId;

  try {
    // 1. Vérifier si l'organisation existe
    const tenant = await getTenantDetails(tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Organisation introuvable." });
    }

    // 2. Vérifier les privilèges
    const myRole = await getTenantMemberRole(tenantId, req.userId);
    const targetRole = await getTenantMemberRole(tenantId, targetMemberId);

    if (!targetRole) {
      return res.status(404).json({ message: "Le membre cible n'appartient pas à cette organisation." });
    }

    if (targetRole === 'owner') {
      return res.status(400).json({ message: "Le propriétaire de l'organisation ne peut pas être retiré." });
    }

    const isSelf = String(req.userId) === String(targetMemberId);
    const isOwner = myRole === 'owner';
    const isAdminOfMember = myRole === 'admin' && targetRole === 'member';

    if (!isSelf && !isOwner && !isAdminOfMember) {
      return res.status(403).json({ message: "Privilèges insuffisants pour retirer ce membre." });
    }

    await pool.query(
      'DELETE FROM tenant_members WHERE tenant_id = ? AND user_id = ?',
      [tenantId, targetMemberId]
    );

    // Envoyer notification de retrait si ce n'est pas un auto-retrait
    if (!isSelf) {
      try {
        await createAndSendNotification(
          targetMemberId,
          'share',
          `Vous avez été retiré de l'organisation "${tenant.name}".`
        );
      } catch {}
    }

    res.json({ message: "Membre retiré de l'organisation avec succès." });
  } catch (err) {
    next(err);
  }
};
