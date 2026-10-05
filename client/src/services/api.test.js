// Tests — services/api.js : DELETE avec corps (S5A-06)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, toAssetUrl } from './api.js';

describe('api.delete', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockFetch() {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 204, json: async () => null });
  }

  it('envoie le corps JSON quand on lui en donne un (ex. mot de passe de confirmation)', async () => {
    const fetchSpy = mockFetch();
    await api.delete('/auth/me', { password: 'secret' });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.method).toBe('DELETE');
    expect(JSON.parse(options.body)).toEqual({ password: 'secret' });
  });

  it("n'envoie aucun corps quand il n'y en a pas (comportement d'avant inchangé)", async () => {
    const fetchSpy = mockFetch();
    await api.delete('/proposals/abc/vote');
    expect(fetchSpy.mock.calls[0][1].body).toBeUndefined();
  });
});

// ── toAssetUrl (S5A-08) ──────────────────────────────────

describe('toAssetUrl', () => {
  it("préfixe un chemin d'image par le serveur de l'API quand celle-ci est sur un autre domaine", () => {
    expect(toAssetUrl('/uploads/proposals/a.webp', 'https://api.senlis-participatif.fr/api/v1'))
      .toBe('https://api.senlis-participatif.fr/uploads/proposals/a.webp');
  });

  it("laisse le chemin tel quel quand l'API est sur le même serveur (URL relative)", () => {
    expect(toAssetUrl('/uploads/a.webp', '/api/v1')).toBe('/uploads/a.webp');
  });

  it('ne touche ni aux adresses complètes, ni aux aperçus locaux, ni aux valeurs vides', () => {
    expect(toAssetUrl('https://cdn.exemple.fr/a.webp', 'https://api.x.fr/api/v1')).toBe('https://cdn.exemple.fr/a.webp');
    expect(toAssetUrl('blob:http://localhost/123', 'https://api.x.fr/api/v1')).toBe('blob:http://localhost/123');
    expect(toAssetUrl(null, 'https://api.x.fr/api/v1')).toBeNull();
  });
});

// ── Messages d'erreur (correctif du 02/10/2026) ───────────
describe('apiFetch — messages d’erreur', () => {
  afterEach(() => vi.restoreAllMocks());

  it("un 429 en texte brut n'est plus présenté comme une « erreur réseau »", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 429, json: async () => { throw new SyntaxError('pas du JSON'); },
    });
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      status: 429, message: expect.stringMatching(/Trop de tentatives/),
    });
  });

  it("une réponse JSON de l'API est transmise telle quelle (code + message)", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false, status: 429, json: async () => ({ error: { code: 'RATE_LIMITED', message: 'Trop de tentatives — réessayez dans 12 minutes.' } }),
    });
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ code: 'RATE_LIMITED', message: /12 minutes/ });
  });

  it('une VRAIE coupure (serveur injoignable) donne NETWORK_ERROR', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('NetworkError when attempting to fetch resource.'));
    await expect(api.get('/health')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
