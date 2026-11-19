import request from 'supertest';
import { createApp } from '../src/app.js';
import { setAdmin } from '../src/modules/auth/auth.service.js';

export const app = createApp();
export const ADMIN = { email: 'admin@test.dev', password: 'super-secret-pass' };

export async function loginAgent() {
  await setAdmin(ADMIN.email, ADMIN.password);
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send(ADMIN).expect(200);
  const token = res.body.accessToken as string;
  return { agent, token, auth: { Authorization: `Bearer ${token}` } };
}

export function projectBody(over: Record<string, unknown> = {}) {
  return {
    title: 'Chillox',
    description: '(Restaurant)',
    thumbnail: 'https://cdn.test/t.png',
    hero: { image: 'https://cdn.test/h.png', video: 'https://cdn.test/h.mp4', poster: '' },
    mainTitle: 'Main',
    subtitle: 'Sub',
    client: 'Chillox Ltd',
    involvement: ['Branding', 'Film', 'Web', 'Social'],
    result: 'Great',
    blocks: [
      { type: 'media', layout: 'full', items: [{ kind: 'image', url: 'https://cdn.test/a.png' }] },
      {
        type: 'media',
        layout: 'split',
        items: [
          { kind: 'video', url: 'https://cdn.test/b.mp4' },
          { kind: 'image', url: 'https://cdn.test/c.png' },
        ],
      },
      { type: 'text', heading: 'Approach', body: 'We did things.' },
    ],
    status: 'published',
    ...over,
  };
}
