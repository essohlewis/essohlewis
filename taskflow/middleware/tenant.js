const pool = require('../config/db');

async function identifyTenant(req, res, next) {
  let tenantSlug = req.headers['x-tenant-slug'];
  let tenantId = req.headers['x-tenant-id'];

  // Si non défini, essayer de l'extraire de l'hôte (ex: acme.localhost:3000 -> acme)
  if (!tenantSlug && !tenantId && req.headers.host) {
    const hostParts = req.headers.host.split('.');
    if (hostParts.length > 2 || (hostParts.length === 2 && !hostParts[1].includes('localhost') && !hostParts[1].includes('127.0.0.1'))) {
      tenantSlug = hostParts[0];
    }
  }

  // Si aucun tenant n'est spécifié, on est en mode "personnel / non-tenant"
  if (!tenantSlug && !tenantId) {
    req.tenantId = null;
    req.tenantSlug = null;
    return next();
  }

  try {
    let tenant;
    if (tenantId) {
      const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
      tenant = rows[0];
    } else if (tenantSlug) {
      const [rows] = await pool.query('SELECT * FROM tenants WHERE slug = ?', [tenantSlug]);
      tenant = rows[0];
    }

    if (!tenant) {
      return res.status(404).json({ message: 'Organisation introuvable.' });
    }

    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;
    req.tenant = tenant;

    next();
  } catch (err) {
    console.error('Erreur d\'identification du tenant :', err.message);
    return res.status(500).json({ message: 'Erreur serveur lors de la vérification de l\'organisation.' });
  }
}

async function checkTenantMembership(req, res, next) {
  // Si nous ne sommes pas dans un contexte de tenant, aucune vérification d'appartenance n'est requise
  if (!req.tenantId) {
    return next();
  }

  // L'utilisateur doit être connecté pour vérifier son appartenance à l'organisation
  if (!req.userId) {
    return res.status(401).json({ message: 'Authentification requise pour accéder à cette organisation.' });
  }

  try {
    const [members] = await pool.query(
      'SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?',
      [req.tenantId, req.userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Vous n\'êtes pas membre de cette organisation.' });
    }

    req.tenantUserRole = members[0].role;
    next();
  } catch (err) {
    console.error('Erreur de vérification d\'appartenance au tenant :', err.message);
    return res.status(500).json({ message: 'Erreur serveur lors de la vérification de vos accès.' });
  }
}

module.exports = { identifyTenant, checkTenantMembership };

