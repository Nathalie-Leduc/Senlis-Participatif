// ══════════════════════════════════════════════════════════
// Tests — vérification DNS du domaine de l'email (S5R-02b)
//
// Le DNS est simulé (dnsMock, voir setup.js) : on choisit, test par
// test, ce que « répond Internet » — domaine inexistant, sans MX,
// « null MX », panne… — sans jamais dépendre du vrai réseau.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { dnsMock } from './setup.js';
import { buildUser, makeCitizen } from './helpers.js';
import { checkEmailDomain } from '../src/lib/emailDomain.js';

/** Fabrique une erreur DNS comme celles de Node (code ENOTFOUND, ETIMEOUT…) */
const dnsError = (code) => Object.assign(new Error(code), { code });

describe('checkEmailDomain', () => {
  it('ok : le domaine a un serveur de messagerie (MX)', async () => {
    expect(await checkEmailDomain('nath@exemple.fr')).toBe('ok');
  });

  it("no-mail : le domaine n'existe pas", async () => {
    dnsMock.resolveMx.mockRejectedValue(dnsError('ENOTFOUND'));
    expect(await checkEmailDomain('nath@domaine-invente.zzz')).toBe('no-mail');
  });

  it("no-mail : le domaine déclare refuser tout courrier (« null MX », RFC 7505)", async () => {
    dnsMock.resolveMx.mockResolvedValue([{ exchange: '', priority: 0 }]);
    expect(await checkEmailDomain('nath@pas-de-courrier.fr')).toBe('no-mail');
  });

  it('ok : pas de MX mais une adresse IP → « MX implicite » (RFC 5321), le courrier arrive', async () => {
    dnsMock.resolveMx.mockRejectedValue(dnsError('ENODATA'));
    dnsMock.resolve4.mockResolvedValue(['192.0.2.10']);
    expect(await checkEmailDomain('nath@petit-domaine.fr')).toBe('ok');
  });

  it("no-mail : ni MX, ni adresse IPv4, ni IPv6", async () => {
    dnsMock.resolveMx.mockRejectedValue(dnsError('ENODATA'));
    dnsMock.resolve4.mockRejectedValue(dnsError('ENODATA'));
    dnsMock.resolve6.mockRejectedValue(dnsError('ENODATA'));
    expect(await checkEmailDomain('nath@coquille-vide.fr')).toBe('no-mail');
  });

  it("unknown : panne ou délai dépassé — on ne sait pas, donc on ne bloque pas", async () => {
    dnsMock.resolveMx.mockRejectedValue(dnsError('ETIMEOUT'));
    expect(await checkEmailDomain('nath@exemple.fr')).toBe('unknown');
  });

  it('convertit un domaine accentué avant la requête (punycode)', async () => {
    await checkEmailDomain('nath@mairie-é.fr');
    expect(dnsMock.resolveMx).toHaveBeenCalledWith('xn--mairie--hya.fr');
  });

  it("met en cache une réponse certaine, mais jamais une panne", async () => {
    await checkEmailDomain('a@cache.fr');
    await checkEmailDomain('b@cache.fr');
    expect(dnsMock.resolveMx).toHaveBeenCalledTimes(1);

    dnsMock.resolveMx.mockRejectedValue(dnsError('ESERVFAIL'));
    await checkEmailDomain('a@panne.fr');
    await checkEmailDomain('b@panne.fr');
    expect(dnsMock.resolveMx).toHaveBeenCalledTimes(3); // 1 + 2 essais pour panne.fr
  });
});

describe('Dans les parcours de l’API', () => {
  it("inscription : 400 EMAIL_DOMAIN_INVALID, avec le message rattaché au champ email", async () => {
    dnsMock.resolveMx.mockRejectedValue(dnsError('ENOTFOUND'));
    const res = await request(app).post('/api/v1/auth/register').send(buildUser({ email: 'nath@domaine-invente.zzz' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMAIL_DOMAIN_INVALID');
    // details.email : le client affiche le message SOUS le champ (S5R-02)
    expect(res.body.error.details.email).toMatch(/ne peut pas recevoir/);
  });

  it("inscription : une panne DNS n'empêche PAS de s'inscrire", async () => {
    dnsMock.resolveMx.mockRejectedValue(dnsError('ETIMEOUT'));
    const res = await request(app).post('/api/v1/auth/register').send(buildUser());
    expect(res.status).toBe(201);
  });

  it("changement d'email vers un domaine inexistant : 400", async () => {
    const { token } = await makeCitizen();
    dnsMock.resolveMx.mockRejectedValue(dnsError('ENOTFOUND'));
    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'nath@domaine-invente.zzz', currentPassword: buildUser().password });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMAIL_DOMAIN_INVALID');
  });

  it('renvoi du lien vers un domaine inexistant : 400', async () => {
    dnsMock.resolveMx.mockRejectedValue(dnsError('ENOTFOUND'));
    const res = await request(app).post('/api/v1/auth/resend-verification').send({ email: 'nath@domaine-invente.zzz' });
    expect(res.status).toBe(400);
  });
});
