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
    // button position defaults when omitted, validates range, and round-trips
    expect(pub.body.homeHero.buttonTopDesktop).toBe(72);
    expect(pub.body.homeHero.buttonTopMobile).toBe(67);
    await request(app).put('/api/v1/admin/settings').set(auth).send({ homeHero: { ...body.homeHero, buttonTopDesktop: 140 } }).expect(400);
    const moved = await request(app)
      .put('/api/v1/admin/settings')
      .set(auth)
      .send({ homeHero: { ...body.homeHero, buttonTopDesktop: 50, buttonTopMobile: 40.5 } })
      .expect(200);
    expect(moved.body.homeHero.buttonTopDesktop).toBe(50);
    expect(moved.body.homeHero.buttonTopMobile).toBe(40.5);
  });
});

describe('settings: contact + project CTA', () => {
  it('serves defaults, updates sections independently, and validates custom links', async () => {
    const pub0 = await request(app).get('/api/v1/settings').expect(200);
    expect(pub0.body.contact.links.map((l: any) => l.type)).toEqual(['email', 'whatsapp', 'instagram', 'linkedin']);
    expect(pub0.body.projectCta.buttonLabel).toBe("Let's Talk");
    expect(pub0.body.branding.logo).toMatch(/rafi_logo.png$/);
    expect(pub0.body.branding.favicon).toBe('');
    expect(pub0.body.ticker.items).toHaveLength(7);

    const { auth } = await loginAgent();
    // saving the hero must not wipe the contact defaults
    await request(app).put('/api/v1/admin/settings').set(auth).send({ homeHero: { image: 'https://cdn.test/h.jpg' } }).expect(200);
    let pub = await request(app).get('/api/v1/settings').expect(200);
    expect(pub.body.contact.links).toHaveLength(4);
    expect(pub.body.projectCta.lines).toHaveLength(2);

    await request(app)
      .put('/api/v1/admin/settings')
      .set(auth)
      .send({ contact: { heading: 'Hi', text: 'Say hi', links: [{ type: 'custom', url: 'https://x.test' }] } })
      .expect(400);

    await request(app)
      .put('/api/v1/admin/settings')
      .set(auth)
      .send({
        contact: { heading: 'Hi', text: '', links: [{ type: 'linkedin', url: 'https://linkedin.com/in/x' }] },
        projectCta: { heading: 'Talk?', lines: ['One line'], buttonLabel: 'Email me', buttonUrl: 'me@x.test' },
      })
      .expect(200);
    pub = await request(app).get('/api/v1/settings').expect(200);
    expect(pub.body.contact).toMatchObject({ heading: 'Hi', text: '', links: [{ type: 'linkedin', label: '', icon: '' }] });
    expect(pub.body.projectCta).toEqual({ heading: 'Talk?', lines: ['One line'], buttonLabel: 'Email me', buttonUrl: 'me@x.test' });
    expect(pub.body.homeHero.image).toBe('https://cdn.test/h.jpg'); // untouched

    await request(app).put('/api/v1/admin/settings').set(auth).send({ branding: { logo: '' } }).expect(400);
    await request(app).put('/api/v1/admin/settings').set(auth).send({ branding: { logo: 'https://cdn.test/logo.svg', favicon: 'https://cdn.test/fav.png' } }).expect(200);
    pub = await request(app).get('/api/v1/settings').expect(200);
    expect(pub.body.branding).toEqual({ logo: 'https://cdn.test/logo.svg', favicon: 'https://cdn.test/fav.png' });
    expect(pub.body.contact.heading).toBe('Hi'); // untouched

    await request(app).put('/api/v1/admin/settings').set(auth).send({ ticker: { items: ['  '] } }).expect(400);
    await request(app).put('/api/v1/admin/settings').set(auth).send({ ticker: { items: ['Branding', 'Film'] } }).expect(200);
    pub = await request(app).get('/api/v1/settings').expect(200);
    expect(pub.body.ticker.items).toEqual(['Branding', 'Film']);
    expect(pub.body.branding.logo).toBe('https://cdn.test/logo.svg'); // untouched

    // an emptied link list is respected (not replaced by defaults)
    await request(app).put('/api/v1/admin/settings').set(auth).send({ contact: { heading: '', text: '', links: [] } }).expect(200);
    pub = await request(app).get('/api/v1/settings').expect(200);
    expect(pub.body.contact.links).toEqual([]);
  });
});
