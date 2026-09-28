// Tests — services/api.js : DELETE avec corps (S5A-06)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './api.js';

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
