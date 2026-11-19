import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ADMIN, app, loginAgent } from './helpers.js';

describe('auth', () => {
  it('rejects bad credentials', async () => {
    await loginAgent();
    await request(app).post('/api/v1/auth/login').send({ ...ADMIN, password: 'wrong-password' }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: 'nobody@x.dev', password: 'whatever12' }).expect(401);
  });

  it('logs in, sets an httpOnly refresh cookie scoped to /api/v1/auth, and returns me', async () => {
    await import('../src/modules/auth/auth.service.js').then((m) => m.setAdmin(ADMIN.email, ADMIN.password));
    const res = await request(app).post('/api/v1/auth/login').send(ADMIN).expect(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/pf_rt=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
    expect(me.body.email).toBe(ADMIN.email);
  });

  it('blocks admin routes without a valid token', async () => {
    await request(app).get('/api/v1/admin/projects').expect(401);
    await request(app).get('/api/v1/admin/projects').set('Authorization', 'Bearer nope').expect(401);
  });

  it('refresh rotates the session; logout revokes it', async () => {
    const { agent } = await loginAgent();
    const r1 = await agent.post('/api/v1/auth/refresh').expect(200);
    expect(r1.body.accessToken).toBeTypeOf('string');
    await agent.post('/api/v1/auth/logout').expect(204);
    await agent.post('/api/v1/auth/refresh').expect(401);
  });

  it('changing the password revokes other sessions but keeps the current one', async () => {
    const a = await loginAgent();
    const other = request.agent(app);
    await other.post('/api/v1/auth/login').send(ADMIN).expect(200);
    await a.agent
      .patch('/api/v1/auth/password')
      .set(a.auth)
      .send({ currentPassword: ADMIN.password, newPassword: 'brand-new-password' })
      .expect(200);
    await other.post('/api/v1/auth/refresh').expect(401);
    await a.agent.post('/api/v1/auth/refresh').expect(200);
  });
});
