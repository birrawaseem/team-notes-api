const request = require('supertest');
const app = require('../app');
const pool = require('../db');

afterAll(() => pool.end());

test('GET /health reports the database is up', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok', db: 'ok' });
});