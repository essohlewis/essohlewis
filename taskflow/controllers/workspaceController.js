const pool = require('../config/db');
const { createAndSendNotification } = require('./notificationController');

// Récupère le rôle d'un utilisateur dans un espace de travail
async function getMemberRole(workspaceId, userId) {
  const [rows] = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    [workspaceId, userId]
  );
  return rows.length > 0 ? rows[0].role : null;
}

// Récupère les détails d'un espace de travail
async function getWorkspaceDetails(workspaceId) {
  const [rows] = await pool.query('SELECT * FROM workspaces WHERE id = ?', [workspaceId]);
  return rows.length > 0 ? rows[0] : null;
}

// ================= ESPACES DE TRAVAIL =================

// Créer un espace de travail
exports.createWorkspace = async (req, res, next) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Le nom de l\'espace de travail est requis.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Insérer l'espace avec tenant_id
    const [wResult] = await conn.query(
      'INSERT INTO workspaces (name, owner_id, tenant_id) VALUES (?, ?, ?)',
      [name.trim(), req.userId, req.tenantId || null]
    );
    const workspaceId = wResult.insertId;

    // 2. Associer le créateur en tant que propriétaire ('owner')
    await conn.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspaceId, req.userId, 'owner']
    );

    await conn.commit();
    res.status(201).json({ id: workspaceId, name: name.trim(), role: 'owner', tenant_id: req.tenantId || null });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// Lister tous les espaces de travail de l'utilisateur connecté
exports.getWorkspaces = async (req, res, next) => {
  try {
    let query = `
      SELECT w.id, w.name, w.owner_id, w.created_at, wm.role 
      FROM workspaces w 
      JOIN workspace_members wm ON w.id = wm.workspace_id 
      WHERE wm.user_id = ?
    `;
    const params = [req.userId];

    if (req.tenantId) {
      query += ' AND w.tenant_id = ?';
      params.push(req.tenantId);
    } else {
      query += ' AND w.tenant_id IS NULL';
    }

    query += ' ORDER BY w.name ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// Supprimer un espace de travail (réservé au propriétaire)
exports.deleteWorkspace = async (req, res, next) => {
  const workspaceId = req.params.id;
  try {
    const workspace = await getWorkspaceDetails(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Espace de travail introuvable.' });
    }

    // Vérification d'isolation tenant
    if (workspace.tenant_id !== (req.tenantId || null)) {
      return res.status(403).json({ message: 'Accès refusé à cet espace de travail.' });
    }

    if (workspace.owner_id !== req.userId) {
      return res.status(403).json({ message: 'Seul le propriétaire peut supprimer l\'espace.' });
    }

    // ON DELETE CASCADE sur la clé étrangère gère la suppression des membres et des tâches
    await pool.query('DELETE FROM workspaces WHERE id = ?', [workspaceId]);
    res.json({ message: 'Espace de travail supprimé.' });
  } catch (err) {
    next(err);
  }
};

// ================= MEMBRES DES ESPACES =================

// Lister les membres d'un espace de travail
exports.getWorkspaceMembers = async (req, res, next) => {
  const workspaceId = req.params.id;
  try {
    const workspace = await getWorkspaceDetails(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Espace de travail introuvable.' });
    }

    // Vérification d'isolation tenant
    if (workspace.tenant_id !== (req.tenantId || null)) {
      return res.status(403).json({ message: 'Accès refusé à cet espace de travail.' });
    }

    // Vérifier si l'utilisateur demandeur appartient à l'espace
    const myRole = await getMemberRole(workspaceId, req.userId);
    if (!myRole) {
      return res.status(403).json({ message: 'Accès refusé aux membres de cet espace.' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar IS NOT NULL as has_avatar, wm.role 
       FROM users u 
       JOIN workspace_members wm ON u.id = wm.user_id 
       WHERE wm.workspace_id = ? 
       ORDER BY wm.role DESC, u.name ASC`,
      [workspaceId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// Ajouter/Inviter un membre par e-mail
exports.addWorkspaceMember = async (req, res, next) => {
  const workspaceId = req.params.id;
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'L\'email du collaborateur est obligatoire.' });
  }

  try {
    // 1. Vérifier si l'espace existe
    const workspace = await getWorkspaceDetails(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Espace de travail introuvable.' });
    }

    // Vérification d'isolation tenant
    if (workspace.tenant_id !== (req.tenantId || null)) {
      return res.status(403).json({ message: 'Accès refusé à cet espace de travail.' });
    }

    // 2. Vérifier les privilèges de l'invitant (owner ou admin requis)
    const myRole = await getMemberRole(workspaceId, req.userId);
    if (myRole !== 'owner' && myRole !== 'admin') {
      return res.status(403).json({ message: 'Privilèges insuffisants pour inviter des membres.' });
    }

    // 3. Trouver le destinataire par email
    const [uRows] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email.trim()]);
    if (uRows.length === 0) {
      return res.status(404).json({ message: 'Aucun utilisateur inscrit avec cet email.' });
    }
    const inviteeId = uRows[0].id;
    const inviteeName = uRows[0].name;

    // 4. Vérifier s'il est déjà membre
    const existingRole = await getMemberRole(workspaceId, inviteeId);
    if (existingRole) {
      return res.status(400).json({ message: 'Cet utilisateur est déjà membre de cet espace.' });
    }

    // 5. Insérer le membre
    await pool.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspaceId, inviteeId, 'member']
    );

    // 6. Envoyer une notification en temps réel au destinataire
    try {
      await createAndSendNotification(
        inviteeId,
        'share',
        `Vous avez été invité dans l'espace de travail "${workspace.name}".`
      );
    } catch (notifErr) {
      console.error('Erreur d\'envoi de la notification d\'invitation :', notifErr);
    }

    res.status(201).json({ id: inviteeId, name: inviteeName, email: email.trim(), role: 'member' });
  } catch (err) {
    next(err);
  }
};

// Retirer un membre de l'espace
exports.removeWorkspaceMember = async (req, res, next) => {
  const workspaceId = req.params.id;
  const targetMemberId = req.params.userId;

  try {
    // 1. Vérifier si l'espace existe
    const workspace = await getWorkspaceDetails(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Espace de travail introuvable.' });
    }

    // Vérification d'isolation tenant
    if (workspace.tenant_id !== (req.tenantId || null)) {
      return res.status(403).json({ message: 'Accès refusé à cet espace de travail.' });
    }

    // 2. Vérifier les privilèges
    const myRole = await getMemberRole(workspaceId, req.userId);
    const targetRole = await getMemberRole(workspaceId, targetMemberId);

    if (!targetRole) {
      return res.status(404).json({ message: 'Le membre cible n\'appartient pas à cet espace.' });
    }

    if (targetRole === 'owner') {
      return res.status(400).json({ message: "Le propriétaire de l'espace ne peut pas être retiré." });
    }

    // Autoriser si :
    // - L'utilisateur se retire lui-même (quitte l'espace)
    // - L'utilisateur connecté est owner de l'espace
    // - L'utilisateur connecté est admin de l'espace et la cible est un membre standard
    const isSelf = String(req.userId) === String(targetMemberId);
    const isOwner = myRole === 'owner';
    const isAdminOfMember = myRole === 'admin' && targetRole === 'member';

    if (!isSelf && !isOwner && !isAdminOfMember) {
      return res.status(403).json({ message: 'Privilèges insuffisants pour retirer ce membre.' });
    }

    await pool.query(
      'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, targetMemberId]
    );

    // Envoyer notification de retrait si ce n'est pas un auto-retrait
    if (!isSelf) {
      try {
        await createAndSendNotification(
          targetMemberId,
          'share',
          `Vous avez été retiré de l'espace de travail "${workspace.name}".`
        );
      } catch {}
    }

    res.json({ message: 'Membre retiré avec succès.' });
  } catch (err) {
    next(err);
  }
};
