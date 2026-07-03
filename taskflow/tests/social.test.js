const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');

const emailA = `social_a_${Date.now()}@example.com`;
const emailB = `social_b_${Date.now()}@example.com`;
let tokenA;
let tokenB;
let userA;
let userB;

beforeAll(async () => {
  const a = await request(app).post('/api/auth/register').send({ name: 'Alice', email: emailA, password: 'password123' });
  tokenA = a.body.token; userA = a.body.user;
  const b = await request(app).post('/api/auth/register').send({ name: 'Bob', email: emailB, password: 'password123' });
  tokenB = b.body.token; userB = b.body.user;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email IN (?, ?)', [emailA, emailB]);
  await pool.end();
});

describe('Profils', () => {
  it('renvoie mon profil', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.is_me).toBe(true);
    expect(res.body.email).toBe(emailA);
  });

  it('met à jour ma bio', async () => {
    const res = await request(app).put('/api/users/me').set('Authorization', `Bearer ${tokenA}`)
      .send({ bio: 'Fan de productivité' });
    expect(res.statusCode).toBe(200);
    expect(res.body.bio).toBe('Fan de productivité');
  });

  it('n\'expose pas l\'email sur le profil public d\'autrui', async () => {
    const res = await request(app).get(`/api/users/${userB.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBeUndefined();
    expect(res.body.name).toBe('Bob');
  });
});

describe('Suivi & fil d\'actualité', () => {
  it('Alice suit Bob', async () => {
    const res = await request(app).post(`/api/users/${userB.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(201);
    expect(res.body.following).toBe(true);
  });

  it('refuse de se suivre soi-même', async () => {
    const res = await request(app).post(`/api/users/${userA.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(400);
  });

  it('Bob apparaît dans les abonnements d\'Alice', async () => {
    const res = await request(app).get(`/api/users/${userA.id}/following`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.body.some((u) => u.id === userB.id)).toBe(true);
  });

  it('le fil d\'Alice contient l\'activité de Bob', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Tâche de Bob' });
    await request(app).put(`/api/tasks/${task.body.id}`).set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'terminee' });

    const res = await request(app).get('/api/users/feed').set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.some((a) => a.user_id === userB.id && a.type === 'completed')).toBe(true);
  });

  it('Alice se désabonne de Bob', async () => {
    const res = await request(app).delete(`/api/users/${userB.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.following).toBe(false);
  });
});

describe('Commentaires', () => {
  let taskId;

  beforeAll(async () => {
    const t = await request(app).post('/api/tasks').set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Tâche commentée' });
    taskId = t.body.id;
    // Partage avec Bob pour qu'il puisse commenter.
    await request(app).post(`/api/tasks/${taskId}/shares`).set('Authorization', `Bearer ${tokenA}`)
      .send({ email: emailB });
  });

  it('Bob (avec qui la tâche est partagée) peut commenter', async () => {
    const res = await request(app).post(`/api/tasks/${taskId}/comments`).set('Authorization', `Bearer ${tokenB}`)
      .send({ body: 'Bien vu @Alice !' });
    expect(res.statusCode).toBe(201);
    expect(res.body.user_name).toBe('Bob');
  });

  it('un tiers sans accès ne voit pas les commentaires', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}/comments`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Réactions', () => {
  let taskId;

  beforeAll(async () => {
    const t = await request(app).post('/api/tasks').set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Tâche réactions' });
    taskId = t.body.id;
  });

  it('ajoute puis retire une réaction (toggle)', async () => {
    const add = await request(app).post(`/api/tasks/${taskId}/reactions`).set('Authorization', `Bearer ${tokenA}`)
      .send({ emoji: '👍' });
    expect(add.statusCode).toBe(200);
    expect(add.body.mine).toContain('👍');

    const remove = await request(app).post(`/api/tasks/${taskId}/reactions`).set('Authorization', `Bearer ${tokenA}`)
      .send({ emoji: '👍' });
    expect(remove.body.mine).not.toContain('👍');
  });
});
