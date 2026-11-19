import { S3Client } from '@aws-sdk/client-s3';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setS3 } from '../src/lib/s3.js';
import { app, loginAgent, projectBody } from './helpers.js';

let s3: S3Client;
let send: ReturnType<typeof vi.fn>;

beforeEach(() => {
  s3 = new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' } });
  send = vi.fn();
  (s3 as any).send = send;
  setS3(s3);
});
afterEach(() => setS3(null));

describe('media', () => {
  it('presigns a POST with size and type conditions', async () => {
    const { auth } = await loginAgent();
    const res = await request(app)
      .post('/api/v1/admin/media/presign')
      .set(auth)
      .send({ filename: '1. Chillox Hero.PNG', contentType: 'image/png', size: 1000 })
      .expect(200);
    expect(res.body.key).toMatch(/^uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}-1-chillox-hero\.png$/);
    expect(res.body.publicUrl).toBe(`https://cdn.test/${res.body.key}`);
    expect(res.body.upload.url).toContain('test-bucket');
    expect(res.body.upload.fields['Content-Type']).toBe('image/png');
    expect(res.body.upload.fields['Cache-Control']).toMatch(/immutable/);
    const policy = JSON.parse(Buffer.from(res.body.upload.fields.Policy, 'base64').toString());
    expect(policy.conditions).toContainEqual(['content-length-range', 1, 1024 * 1024]);
  });

  it('rejects disallowed types and oversize files', async () => {
    const { auth } = await loginAgent();
    await request(app)
      .post('/api/v1/admin/media/presign')
      .set(auth)
      .send({ filename: 'x.exe', contentType: 'application/x-msdownload', size: 10 })
      .expect(400);
    await request(app)
      .post('/api/v1/admin/media/presign')
      .set(auth)
      .send({ filename: 'big.png', contentType: 'image/png', size: 5 * 1024 * 1024 })
      .expect(400);
  });

  it('confirms an upload via HeadObject and blocks deleting in-use media', async () => {
    const { auth } = await loginAgent();
    send.mockResolvedValueOnce({ ContentType: 'video/mp4', ContentLength: 4242 });
    const key = 'uploads/2026/11/abc-hero.mp4';
    const m = await request(app).post('/api/v1/admin/media').set(auth).send({ key, originalName: 'hero.mp4' }).expect(201);
    expect(m.body.kind).toBe('video');
    expect(m.body.size).toBe(4242);

    await request(app)
      .post('/api/v1/admin/projects')
      .set(auth)
      .send(projectBody({ hero: { image: '', video: m.body.url, poster: '' } }))
      .expect(201);
    const del = await request(app).delete(`/api/v1/admin/media/${m.body.id}`).set(auth).expect(409);
    expect(del.body.error.code).toBe('MEDIA_IN_USE');

    const list = await request(app).get('/api/v1/admin/media?kind=video').set(auth).expect(200);
    expect(list.body.total).toBe(1);
  });

  it('rejects keys outside the upload prefix', async () => {
    const { auth } = await loginAgent();
    await request(app).post('/api/v1/admin/media').set(auth).send({ key: 'secret/file.png' }).expect(400);
  });
});
