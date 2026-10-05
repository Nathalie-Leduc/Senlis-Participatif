// ══════════════════════════════════════════════════════════
// Tests — limiteur des routes d'authentification
// (correctif « Erreur réseau » à la connexion admin, 02/10/2026)
//
// On monte le limiteur sur une mini-application avec une limite de 2,
// pour ne pas dépendre de la limite large utilisée par les autres tests.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthLimiter } from '../src/middlewares/rateLimiters.js';

/** Une route qui réussit ou échoue selon ?ok=1 */
function makeApp() {
  const app = express();
  app.post('/login', createAuthLimiter({ max: 2 }), (req, res) => {
    if (req.query.ok === '1') return res.json({ ok: true });
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS' } });
  });
  return app;
}

describe('Limiteur des routes d’authentification', () => {
  it('répond en JSON lisible (et non en texte brut), avec le délai à attendre', async () => {
    const app = makeApp();
    await request(app).post('/login');
    await request(app).post('/login');
    const blocked = await request(app).post('/login');

    expect(blocked.status).toBe(429);
    expect(blocked.headers['content-type']).toMatch(/application\/json/);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toMatch(/réessayez dans \d+ minute/);
  });

  it('les connexions RÉUSSIES ne consomment pas le quota', async () => {
    const app = makeApp();
    for (let i = 0; i < 5; i++) {
      const ok = await request(app).post('/login?ok=1');
      expect(ok.status).toBe(200);
    }
    // Les 2 échecs autorisés sont toujours disponibles
    expect((await request(app).post('/login')).status).toBe(401);
    expect((await request(app).post('/login')).status).toBe(401);
    expect((await request(app).post('/login')).status).toBe(429);
  });

  it('indique le quota restant dans les en-têtes standard RateLimit-*', async () => {
    const res = await request(makeApp()).post('/login');
    expect(res.headers['ratelimit-limit']).toBe('2');
  });
});
