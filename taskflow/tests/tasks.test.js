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

describe('Édition complète PUT /api/tasks/:id', () => {
  let id;

  beforeAll(async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'À éditer', description: 'desc', tag: 'x', due_date: '2026-01-01' });
    id = res.body.id;
  });

  it('modifie plusieurs champs à la fois', async () => {
    const res = await request(app)
      .put(`/api/tasks/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Titre modifié', description: 'nouvelle desc', priority: 'haute', tag: 'projet' });

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Titre modifié');
    expect(res.body.priority).toBe('haute');
    expect(res.body.tag).toBe('projet');
  });

  it('efface l\'échéance quand due_date est null', async () => {
    const res = await request(app)
      .put(`/api/tasks/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ due_date: null });

    expect(res.statusCode).toBe(200);
    expect(res.body.due_date).toBeNull();
  });

  it('conserve les champs non fournis', async () => {
    const res = await request(app)
      .put(`/api/tasks/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'en_cours' });

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe('Titre modifié'); // inchangé
    expect(res.body.status).toBe('en_cours');
  });
});

describe('Rappels d\'échéance GET /api/tasks/reminders', () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  beforeAll(async () => {
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'En retard', due_date: yesterday, status: 'a_faire' });
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Pour aujourd\'hui', due_date: today, status: 'en_cours' });
  });

  it('renvoie les tâches en retard et à échéance proche', async () => {
    const res = await request(app)
      .get('/api/tasks/reminders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.overdue.some((t) => t.title === 'En retard')).toBe(true);
    expect(res.body.soon.some((t) => t.title === 'Pour aujourd\'hui')).toBe(true);
  });

  it('exclut les tâches terminées des rappels', async () => {
    const created = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Terminée mais en retard', due_date: yesterday, status: 'terminee' });

    const res = await request(app)
      .get('/api/tasks/reminders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.overdue.some((t) => t.id === created.body.id)).toBe(false);
  });
});

describe('Export / Import /api/tasks', () => {
  it('exporte les tâches en JSON', async () => {
    const res = await request(app)
      .get('/api/tasks/export?format=json')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('exporte les tâches en CSV', async () => {
    const res = await request(app)
      .get('/api/tasks/export?format=csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toBe('title,description,status,priority,tag,due_date');
  });

  it('importe des tâches et ignore les lignes sans titre', async () => {
    const res = await request(app)
      .post('/api/tasks/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tasks: [
          { title: 'Importée A', priority: 'haute', status: 'en_cours' },
          { title: 'Importée B', tag: 'import' },
          { description: 'sans titre → ignorée' }
        ]
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.skipped).toBe(1);
  });

  it('refuse un import vide', async () => {
    const res = await request(app)
      .post('/api/tasks/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ tasks: [] });

    expect(res.statusCode).toBe(422);
  });
});

describe('Sous-tâches /api/tasks/:id/subtasks', () => {
  let parentId;
  let subId;

  beforeAll(async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tâche avec checklist' });
    parentId = res.body.id;
  });

  it('crée une sous-tâche', async () => {
    const res = await request(app)
      .post(`/api/tasks/${parentId}/subtasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Première étape' });

    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Première étape');
    expect(res.body.done).toBe(0);
    subId = res.body.id;
  });

  it('refuse une sous-tâche sans titre', async () => {
    const res = await request(app)
      .post(`/api/tasks/${parentId}/subtasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' });

    expect(res.statusCode).toBe(422);
  });

  it('coche une sous-tâche', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${parentId}/subtasks/${subId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ done: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(1);
  });

  it('renvoie l\'avancement des sous-tâches dans la liste des tâches', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    const parent = res.body.find((t) => t.id === parentId);
    expect(parent.subtasks_total).toBe(1);
    expect(parent.subtasks_done).toBe(1);
  });

  it('supprime une sous-tâche', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${parentId}/subtasks/${subId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  it('supprime les sous-tâches en cascade avec la tâche parente', async () => {
    await request(app).post(`/api/tasks/${parentId}/subtasks`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'À supprimer en cascade' });
    await request(app).delete(`/api/tasks/${parentId}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/tasks/${parentId}/subtasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
  });
});
