import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME_HERO } from '../src/modules/settings/settings.model.js';
import { app, loginAgent } from './helpers.js';

describe('settings', () => {
  it('serves the default hero before anything is saved', async () => {
    const res = await request(app).get('/api/v1/settings').expect(200);
    expect(res.body.homeHero.image).toBe(DEFAULT_HOME_HERO.image);
    expect(res.headers['cache-control']).toMatch(/public/);
  });

  it('requires auth to update, validates, and invalidates the public cache', async () => {
    await request(app).put('/api/v1/admin/settings').send({}).expect(401);
    const { auth } = await loginAgent();
    await request(app).get('/api/v1/settings').expect(200); // warm cache
    await request(app).put('/api/v1/admin/settings').set(auth).send({ homeHero: { image: '' } }).expect(400);
    const body = { homeHero: { image: 'https://cdn.test/hero.jpg', mobileImage: 'https://cdn.test/m.jpg', video: '', alt: 'Hero' } };
    const put = await request(app).put('/api/v1/admin/settings').set(auth).send(body).expect(200);
    expect(put.body.homeHero.mobileImage).toBe('https://cdn.test/m.jpg');
    const pub = await request(app).get('/api/v1/settings').expect(200);
    expect(pub.body.homeHero.image).toBe('https://cdn.test/hero.jpg');
    expect(pub.body.homeHero.alt).toBe('Hero');
  });
});
