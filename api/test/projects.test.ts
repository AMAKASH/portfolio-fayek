import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, loginAgent, projectBody } from './helpers.js';

async function create(auth: Record<string, string>, over: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/v1/admin/projects').set(auth).send(projectBody(over)).expect(201);
  return res.body;
}

describe('projects: admin CRUD', () => {
  it('creates with an auto slug, de-duplicates slugs and keeps block ids', async () => {
    const { auth } = await loginAgent();
    const a = await create(auth);
    expect(a.slug).toBe('chillox');
    expect(a.version).toBe(0);
    expect(a.blocks).toHaveLength(3);
    expect(a.blocks[0].id).toMatch(/^[a-f\d]{24}$/);
    const b = await create(auth);
    expect(b.slug).toBe('chillox-2');
    expect(b.order).toBe(a.order + 1);
  });

  it('rejects an explicit slug that is taken and validates block shapes', async () => {
    const { auth } = await loginAgent();
    await create(auth, { slug: 'taken' });
    await request(app).post('/api/v1/admin/projects').set(auth).send(projectBody({ slug: 'taken' })).expect(409);
    const bad = projectBody({
      blocks: [{ type: 'media', layout: 'split', items: [{ kind: 'image', url: 'x' }] }],
    });
    const res = await request(app).post('/api/v1/admin/projects').set(auth).send(bad).expect(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('updates with optimistic concurrency (409 on stale version)', async () => {
    const { auth } = await loginAgent();
    const p = await create(auth);
    const { id, version, createdAt: _c, updatedAt: _u, publishedAt: _p, order: _o, featuredOrder: _f, ...rest } = p;
    const u1 = await request(app)
      .put(`/api/v1/admin/projects/${id}`)
      .set(auth)
      .send({ ...rest, title: 'Chillox v2', version })
      .expect(200);
    expect(u1.body.version).toBe(version + 1);
    expect(u1.body.blocks[0].id).toBe(p.blocks[0].id); // block identity preserved
    const stale = await request(app)
      .put(`/api/v1/admin/projects/${id}`)
      .set(auth)
      .send({ ...rest, title: 'stale', version })
      .expect(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
  });

  it('patches toggles, duplicates, reorders and deletes', async () => {
    const { auth } = await loginAgent();
    const a = await create(auth, { title: 'A' });
    const b = await create(auth, { title: 'B' });
    await request(app).patch(`/api/v1/admin/projects/${a.id}`).set(auth).send({ featured: true }).expect(200);
    const dup = await request(app).post(`/api/v1/admin/projects/${a.id}/duplicate`).set(auth).expect(201);
    expect(dup.body.status).toBe('draft');
    expect(dup.body.featured).toBe(false);
    await request(app).put('/api/v1/admin/projects/reorder').set(auth).send({ ids: [b.id, dup.body.id, a.id] }).expect(204);
    const list = await request(app).get('/api/v1/admin/projects').set(auth).expect(200);
    expect(list.body.items.map((i: any) => i.title)).toEqual(['B', 'A (copy)', 'A']);
    await request(app).delete(`/api/v1/admin/projects/${dup.body.id}`).set(auth).expect(204);
    const avail = await request(app).get('/api/v1/admin/projects/slug-available?slug=a').set(auth).expect(200);
    expect(avail.body.available).toBe(false);
  });
});

describe('projects: public', () => {
  it('hides drafts and unlisted from the grid; prev/next wraps around', async () => {
    const { auth } = await loginAgent();
    const a = await create(auth, { title: 'Alpha' });
    await create(auth, { title: 'Draft', status: 'draft' });
    const b = await create(auth, { title: 'Beta' });
    const c = await create(auth, { title: 'Gamma' });
    await create(auth, { title: 'Hidden', listed: false });

    const list = await request(app).get('/api/v1/projects').expect(200);
    expect(list.body.items.map((i: any) => i.slug)).toEqual(['alpha', 'beta', 'gamma']);
    expect(list.headers['cache-control']).toMatch(/public/);
    expect(list.body.items[0]).not.toHaveProperty('blocks');

    const first = await request(app).get('/api/v1/projects/alpha').expect(200);
    expect(first.body.prev.slug).toBe('gamma');
    expect(first.body.next.slug).toBe('beta');
    expect(first.body).not.toHaveProperty('status');
    const last = await request(app).get(`/api/v1/projects/${c.slug}`).expect(200);
    expect(last.body.next.slug).toBe(a.slug);

    await request(app).get('/api/v1/projects/draft').expect(404);
    await request(app).get('/api/v1/projects/hidden').expect(200); // unlisted but published: reachable by slug

    const legacy = await request(app).get('/api/v1/projects/1').expect(200);
    expect(legacy.body.redirect.slug).toBe(b.slug);
  });

  it('serves featured tiles in featured order and invalidates cache on writes', async () => {
    const { auth } = await loginAgent();
    const a = await create(auth, { title: 'One', featured: true, featuredImage: 'https://cdn.test/f1.png' });
    const b = await create(auth, { title: 'Two', featured: true, blocks: [] });
    let res = await request(app).get('/api/v1/projects/featured').expect(200);
    expect(res.body.items.map((i: any) => i.slug)).toEqual(['one', 'two']);
    expect(res.body.items[0].image).toBe('https://cdn.test/f1.png');
    expect(res.body.items[1].hasDetails).toBe(false);

    await request(app).put('/api/v1/admin/projects/featured/reorder').set(auth).send({ ids: [b.id, a.id] }).expect(204);
    res = await request(app).get('/api/v1/projects/featured').expect(200);
    expect(res.body.items.map((i: any) => i.slug)).toEqual(['two', 'one']);
  });

  it('returns 304 for a matching ETag', async () => {
    const { auth } = await loginAgent();
    await create(auth);
    const r1 = await request(app).get('/api/v1/projects').expect(200);
    await request(app).get('/api/v1/projects').set('If-None-Match', r1.headers['etag']!).expect(304);
  });
});
