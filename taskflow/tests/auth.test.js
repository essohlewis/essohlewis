// Ces tests nécessitent une vraie base MySQL accessible via les variables
// d'environnement du fichier .env (idéalement une base de test dédiée,
// jamais la base de production). Lance : npm test

const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

const testEmail = `test_${Date.now()}@example.com`;

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
  await pool.end();
});

describe('POST /api/auth/register', () => {
  it('crée un compte avec des données valides', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: testEmail,
      password: 'password123'
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
  });

  it('refuse un mot de passe trop court', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: `short_${Date.now()}@example.com`,
      password: '123'
    });

    expect(res.statusCode).toBe(422);
  });

  it('refuse un email déjà utilisé', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: testEmail,
      password: 'password123'
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte avec les bons identifiants', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'password123'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('refuse un mauvais mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'mauvais_mot_de_passe'
    });

    expect(res.statusCode).toBe(401);
  });

  it('renvoie un refresh token à la connexion', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'password123'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.refreshToken).toBeDefined();
  });
});

describe('POST /api/auth/refresh & /logout', () => {
  let refreshToken;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'password123'
    });
    refreshToken = res.body.refreshToken;
  });

  it('échange un refresh token contre un nouveau token d\'accès', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken); // rotation
    refreshToken = res.body.refreshToken;
  });

  it('invalide l\'ancien refresh token après rotation', async () => {
    // On rafraîchit une fois pour obtenir un token courant...
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken });
    const used = refreshToken;
    refreshToken = first.body.refreshToken;

    // ...puis on réutilise l'ancien : il doit être rejeté.
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: used });
    expect(reuse.statusCode).toBe(401);
  });

  it('refuse un refresh token inconnu', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'inexistant' });
    expect(res.statusCode).toBe(401);
  });

  it('révoque le refresh token à la déconnexion', async () => {
    const logout = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logout.statusCode).toBe(200);

    const after = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(after.statusCode).toBe(401);
  });
});
