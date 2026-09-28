// ══════════════════════════════════════════════════════════
// Tests — Préparation à la production (S5A-08)
// ══════════════════════════════════════════════════════════

import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('En-têtes de sécurité', () => {
  it("les fichiers de l'API sont partageables avec le même SITE (images vues depuis senlis-participatif.fr)", async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
  });

  it('Helmet reste actif pour le reste (ex. anti-« sniffing » du type de fichier)', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('trust proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("hors production, n'accorde aucune confiance à X-Forwarded-For (sinon n'importe qui choisirait son IP)", () => {
    expect(app.get('trust proxy')).toBe(0);
  });

  it('en production, fait confiance à UN intermédiaire (le répartiteur de charge)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules(); // réimporte app.js avec le nouvel environnement
    const { default: prodApp } = await import('../src/app.js');
    expect(prodApp.get('trust proxy')).toBe(1);
  });

  it('TRUST_PROXY permet de l’ajuster (ex. 2 intermédiaires)', async () => {
    vi.stubEnv('TRUST_PROXY', '2');
    vi.resetModules();
    const { default: customApp } = await import('../src/app.js');
    expect(customApp.get('trust proxy')).toBe(2);
  });
});
