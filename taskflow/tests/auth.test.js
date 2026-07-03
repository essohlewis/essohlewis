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
});
