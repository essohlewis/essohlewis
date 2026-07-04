// Tests des rappels d'échéance automatiques.
// Nécessitent une base MySQL accessible (comme les autres tests d'intégration).

const request = require('supertest');
const app = require('../server');
const pool = require('../config/db');
const { runDueReminderScan, reminderMessage } = require('../utils/dueReminders');

const testEmail = `reminders_${Date.now()}@example.com`;
let token;
let userId;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Reminders Tester',
    email: testEmail,
    password: 'password123'
  });
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
  await pool.end();
});

describe('reminderMessage()', () => {
  it('formule un message « en retard » pour une tâche overdue', () => {
    expect(reminderMessage({ title: 'X', kind: 'overdue' })).toMatch(/en retard/);
  });
  it('formule un message « échéance » pour une tâche soon', () => {
    expect(reminderMessage({ title: 'X', kind: 'soon' })).toMatch(/échéance/);
  });
});

describe('runDueReminderScan()', () => {
  let overdueId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tâche en retard', due_date: '2000-01-01' });
    overdueId = res.body.id;
  });

  it('notifie le propriétaire d\'une tâche en retard, une seule fois (anti-doublon)', async () => {
    const calls = [];
    const spyNotify = async (uid, type, message) => { calls.push({ uid, type, message }); };

    await runDueReminderScan(pool, spyNotify);
    const mine = calls.filter((c) => c.uid === userId);
    expect(mine.length).toBe(1);
    expect(mine[0].type).toBe('reminder');
    expect(mine[0].message).toMatch(/en retard/);

    // due_reminded_at est désormais renseigné.
    const [[row]] = await pool.query('SELECT due_reminded_at FROM tasks WHERE id = ?', [overdueId]);
    expect(row.due_reminded_at).not.toBeNull();

    // Deuxième passage : plus de notification pour cette tâche.
    const calls2 = [];
    await runDueReminderScan(pool, async (uid) => { calls2.push(uid); });
    expect(calls2.filter((u) => u === userId).length).toBe(0);
  });

  it('réarme le rappel quand l\'échéance change (PUT)', async () => {
    await request(app)
      .put(`/api/tasks/${overdueId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ due_date: '2000-02-02' });

    const [[row]] = await pool.query('SELECT due_reminded_at FROM tasks WHERE id = ?', [overdueId]);
    expect(row.due_reminded_at).toBeNull();

    const calls = [];
    await runDueReminderScan(pool, async (uid) => { calls.push(uid); });
    expect(calls.filter((u) => u === userId).length).toBe(1);
  });

  it('ne rappelle pas une tâche terminée', async () => {
    // Nouvelle tâche en retard, puis marquée terminée avant le scan.
    const created = (await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Retard mais terminée', due_date: '2000-03-03' })).body;
    await request(app)
      .put(`/api/tasks/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'terminee' });

    const calls = [];
    await runDueReminderScan(pool, async (uid, type, message) => { calls.push(message); });
    expect(calls.some((m) => m.includes('terminée'))).toBe(false);
  });
});
