const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

const testEmail = `tasks_${Date.now()}@example.com`;
let token;
let taskId;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Tasks Tester',
    email: testEmail,
    password: 'password123'
  });
  token = res.body.token;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
  await pool.end();
});

describe('CRUD /api/tasks', () => {
  it('refuse l\'accès sans token', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.statusCode).toBe(401);
  });

  it('crée une tâche', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Écrire les tests', priority: 'haute', tag: 'dev' });

    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Écrire les tests');
    taskId = res.body.id;
  });

  it('refuse une tâche sans titre', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' });

    expect(res.statusCode).toBe(422);
  });

  it('liste les tâches de l\'utilisateur', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('filtre les tâches par priorité', async () => {
    const res = await request(app)
      .get('/api/tasks?priority=haute')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.every((t) => t.priority === 'haute')).toBe(true);
  });

  it('met à jour le statut d\'une tâche', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'terminee' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('terminee');
  });

  it('renvoie des statistiques cohérentes', async () => {
    const res = await request(app)
      .get('/api/tasks/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.terminee).toBeGreaterThanOrEqual(1);
  });

  it('supprime une tâche', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  it('renvoie 404 pour une tâche supprimée', async () => {
    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
  });
});

describe('Recherche plein texte GET /api/tasks?search=', () => {
  beforeAll(async () => {
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Préparer la présentation trimestrielle', description: 'Slides et budget' });
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Arroser les plantes', description: 'Balcon' });
  });

  it('trouve une tâche par un mot du titre', async () => {
    const res = await request(app)
      .get('/api/tasks?search=presentation')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.some((t) => /présentation/i.test(t.title))).toBe(true);
  });

  it('trouve une tâche par un mot de la description', async () => {
    const res = await request(app)
      .get('/api/tasks?search=budget')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('Actions groupées PATCH /api/tasks/bulk', () => {
  let ids = [];

  beforeAll(async () => {
    ids = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
        .send({ title: `Tâche groupée ${i}`, status: 'a_faire' });
      ids.push(res.body.id);
    }
  });

  it('refuse une action invalide', async () => {
    const res = await request(app)
      .patch('/api/tasks/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids, action: 'inexistante' });

    expect(res.statusCode).toBe(422);
  });

  it('déplace plusieurs tâches en une seule requête', async () => {
    const res = await request(app)
      .patch('/api/tasks/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids, action: 'status', value: 'terminee' });

    expect(res.statusCode).toBe(200);
    expect(res.body.affected).toBe(3);

    const check = await request(app)
      .get('/api/tasks?status=terminee')
      .set('Authorization', `Bearer ${token}`);
    const done = check.body.filter((t) => ids.includes(t.id));
    expect(done.every((t) => t.status === 'terminee')).toBe(true);
  });

  it('supprime plusieurs tâches en une seule requête', async () => {
    const res = await request(app)
      .patch('/api/tasks/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids, action: 'delete' });

    expect(res.statusCode).toBe(200);
    expect(res.body.affected).toBe(3);
  });
});
