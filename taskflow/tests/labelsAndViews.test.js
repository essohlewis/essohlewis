// Tests des étiquettes multiples et des vues enregistrées.
// Nécessitent une base MySQL accessible (comme les autres tests d'intégration).

const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

const testEmail = `labels_${Date.now()}@example.com`;
let token;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Labels Tester',
    email: testEmail,
    password: 'password123'
  });
  token = res.body.token;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
  await pool.end();
});

describe('Étiquettes multiples /api/tasks', () => {
  let taskId;

  it('crée une tâche avec des étiquettes dédoublonnées', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tâche étiquetée', labels: ['urgent', 'dev', 'URGENT', '  '] });

    expect(res.statusCode).toBe(201);
    expect(res.body.labels).toEqual(['urgent', 'dev']);
    taskId = res.body.id;
  });

  it('refuse un champ labels qui n\'est pas un tableau', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mauvais labels', labels: 'pas-un-tableau' });
    expect(res.statusCode).toBe(422);
  });

  it('renvoie les étiquettes dans la liste des tâches', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);
    const t = res.body.find((x) => x.id === taskId);
    expect(t.labels.sort()).toEqual(['dev', 'urgent']);
  });

  it('filtre les tâches par étiquette', async () => {
    const res = await request(app)
      .get('/api/tasks?label=dev')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.some((x) => x.id === taskId)).toBe(true);

    const none = await request(app)
      .get('/api/tasks?label=inexistante')
      .set('Authorization', `Bearer ${token}`);
    expect(none.body.some((x) => x.id === taskId)).toBe(false);
  });

  it('remplace les étiquettes à la mise à jour', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ labels: ['review'] });
    expect(res.body.labels).toEqual(['review']);

    const detail = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.labels).toEqual(['review']);
  });

  it('retire toutes les étiquettes avec un tableau vide', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ labels: [] });
    expect(res.body.labels).toEqual([]);
  });
});

describe('Vues enregistrées /api/views', () => {
  let viewId;

  it('crée une vue en ne conservant que des filtres connus', async () => {
    const res = await request(app)
      .post('/api/views')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mes urgentes', filters: { priority: 'haute', sort: 'echeance', pirate: 'x' } });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Mes urgentes');
    expect(res.body.filters).toEqual({ priority: 'haute', sort: 'echeance' });
    viewId = res.body.id;
  });

  it('refuse une vue sans nom', async () => {
    const res = await request(app)
      .post('/api/views')
      .set('Authorization', `Bearer ${token}`)
      .send({ filters: {} });
    expect(res.statusCode).toBe(400);
  });

  it('liste les vues de l\'utilisateur', async () => {
    const res = await request(app)
      .get('/api/views')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    const v = res.body.find((x) => x.id === viewId);
    expect(v).toBeDefined();
    expect(v.filters.priority).toBe('haute');
  });

  it('supprime une vue puis renvoie 404 à la seconde suppression', async () => {
    const del1 = await request(app)
      .delete(`/api/views/${viewId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del1.statusCode).toBe(200);

    const del2 = await request(app)
      .delete(`/api/views/${viewId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del2.statusCode).toBe(404);
  });
});
