const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const { resetDb } = require('./helpers');

// Lets the first (n - 1) queries hit the real database, then fails query n.
function failNthQuery(n) {
  const realQuery = pool.query.bind(pool);
  let calls = 0;
  jest.spyOn(pool, 'query').mockImplementation((...args) => {
    calls += 1;
    if (calls === n) return Promise.reject(new Error('DB down'));
    return realQuery(...args);
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
}

beforeEach(() => resetDb());
afterEach(() => jest.restoreAllMocks());
afterAll(() => pool.end());

// Seed data: Alice (1) is in Engineering (1) and Design (2),
// Bob (2) is in Engineering, Carol (3) is in Design.
// Note 1: Engineering, by Alice. Note 2: Engineering, by Bob.
// Note 3: Design, by Carol.

describe('GET /teams/:teamId/notes', () => {
  test('lists notes for a team member', async () => {
    const res = await request(app).get('/teams/1/notes').set('X-User-Id', '2');
    expect(res.status).toBe(200);
    expect(res.body.map((n) => n.id).sort()).toEqual([1, 2]);
  });

  test('returns 404 for a non-member', async () => {
    const res = await request(app).get('/teams/2/notes').set('X-User-Id', '2');
    expect(res.status).toBe(404);
  });

  test('returns 400 for an invalid team id', async () => {
    const res = await request(app).get('/teams/abc/notes').set('X-User-Id', '2');
    expect(res.status).toBe(400);
  });

  test('returns 500 if the membership check fails', async () => {
    const realQuery = pool.query.bind(pool);
    jest
      .spyOn(pool, 'query')
      .mockImplementationOnce(realQuery) // user lookup succeeds
      .mockRejectedValueOnce(new Error('DB down')); // membership check fails
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/teams/1/notes').set('X-User-Id', '2');
    expect(res.status).toBe(500);
  });
});

describe('POST /teams/:teamId/notes', () => {
  test('creates a note as the current user', async () => {
    const res = await request(app)
      .post('/teams/1/notes')
      .set('X-User-Id', '2')
      .send({ title: 'Standup', body: 'Notes from today' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      team_id: 1,
      author_id: 2,
      title: 'Standup',
      body: 'Notes from today',
    });
  });

  test('ignores an author_id in the request body', async () => {
    const res = await request(app)
      .post('/teams/1/notes')
      .set('X-User-Id', '2')
      .send({ title: 'Sneaky', author_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.author_id).toBe(2);
  });

  test.each([
    ['missing title', {}],
    ['blank title', { title: '   ' }],
    ['title too long', { title: 'a'.repeat(201) }],
    ['non-string body', { title: 'Ok', body: 123 }],
  ])('returns 400 for %s', async (_, payload) => {
    const res = await request(app)
      .post('/teams/1/notes')
      .set('X-User-Id', '2')
      .send(payload);
    expect(res.status).toBe(400);
  });

  test('returns 404 for a non-member', async () => {
    const res = await request(app)
      .post('/teams/2/notes')
      .set('X-User-Id', '2')
      .send({ title: 'Not my team' });
    expect(res.status).toBe(404);
  });
});

describe('GET /notes/:noteId', () => {
  test('returns a note to a team member', async () => {
    const res = await request(app).get('/notes/1').set('X-User-Id', '2');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  test('returns 404 to a non-member', async () => {
    const res = await request(app).get('/notes/3').set('X-User-Id', '2');
    expect(res.status).toBe(404);
  });

  test('returns 404 for a note that does not exist', async () => {
    const res = await request(app).get('/notes/999').set('X-User-Id', '1');
    expect(res.status).toBe(404);
  });

  test('returns 400 for an invalid note id', async () => {
    const res = await request(app).get('/notes/abc').set('X-User-Id', '1');
    expect(res.status).toBe(400);
  });
});

describe('PATCH /notes/:noteId', () => {
  test('lets the author update the title only', async () => {
    const res = await request(app)
      .patch('/notes/1')
      .set('X-User-Id', '1')
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
    expect(res.body.body).toBe('Goals for this sprint...');
  });

  test('returns 403 for a teammate who is not the author', async () => {
    const res = await request(app)
      .patch('/notes/1')
      .set('X-User-Id', '2')
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  test('returns 404 for a non-member', async () => {
    const res = await request(app)
      .patch('/notes/1')
      .set('X-User-Id', '3')
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  test('returns 400 when no fields are sent', async () => {
    const res = await request(app)
      .patch('/notes/1')
      .set('X-User-Id', '1')
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /notes/:noteId', () => {
  test('lets the author delete their note', async () => {
    const res = await request(app).delete('/notes/2').set('X-User-Id', '2');
    expect(res.status).toBe(204);

    const after = await request(app).get('/notes/2').set('X-User-Id', '2');
    expect(after.status).toBe(404);
  });

  test('returns 403 for a teammate who is not the author', async () => {
    const res = await request(app).delete('/notes/2').set('X-User-Id', '1');
    expect(res.status).toBe(403);
  });

  test('returns 404 for a non-member', async () => {
    const res = await request(app).delete('/notes/2').set('X-User-Id', '3');
    expect(res.status).toBe(404);
  });
});

describe('PATCH validation', () => {
  test.each([
    ['invalid note id', '/notes/abc', { title: 'Ok' }],
    ['blank title', '/notes/1', { title: '   ' }],
    ['title too long', '/notes/1', { title: 'a'.repeat(201) }],
    ['non-string body', '/notes/1', { body: 123 }],
  ])('returns 400 for %s', async (_, url, payload) => {
    const res = await request(app)
      .patch(url)
      .set('X-User-Id', '1')
      .send(payload);
    expect(res.status).toBe(400);
  });
});

describe('DELETE validation', () => {
  test('returns 400 for an invalid note id', async () => {
    const res = await request(app).delete('/notes/abc').set('X-User-Id', '1');
    expect(res.status).toBe(400);
  });
});

describe('database errors in note routes', () => {
  // Query order per request:
  //   team routes: 1 user lookup, 2 membership check, 3 route query
  //   note routes: 1 user lookup, 2 route query
  test.each([
    ['list notes', 3, (r) => r.get('/teams/1/notes')],
    ['create note', 3, (r) => r.post('/teams/1/notes').send({ title: 'x' })],
    ['get note', 2, (r) => r.get('/notes/1')],
    ['update note', 2, (r) => r.patch('/notes/1').send({ title: 'x' })],
    ['delete note', 2, (r) => r.delete('/notes/1')],
  ])('returns 500 when %s fails', async (_, failAt, send) => {
    failNthQuery(failAt);
    const res = await send(request(app)).set('X-User-Id', '1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});