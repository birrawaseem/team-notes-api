const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const { resetDb } = require('./helpers');

beforeEach(() => resetDb());
afterAll(() => pool.end());
afterEach(() => jest.restoreAllMocks());

describe('X-User-Id authentication', () => {
  test('rejects a request with no header', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  test('rejects a non-numeric user id', async () => {
    const res = await request(app).get('/me').set('X-User-Id', 'abc');
    expect(res.status).toBe(401);
  });

  test('rejects an unknown user id', async () => {
    const res = await request(app).get('/me').set('X-User-Id', '999');
    expect(res.status).toBe(401);
  });

  test('returns the current user for a valid id', async () => {
    const res = await request(app).get('/me').set('X-User-Id', '1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

    test('returns 500 if the database fails during lookup', async () => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('DB down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/me').set('X-User-Id', '1');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});