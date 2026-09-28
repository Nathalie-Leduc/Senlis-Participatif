// ══════════════════════════════════════════════════════════
// Tests — Durées de conservation et purge automatique (S5A-05)
//
// Astuce centrale : toutes les fonctions de services/retention.js
// reçoivent `now` en paramètre. Au lieu d'attendre 3 ans, on crée
// des comptes « nés il y a longtemps » et on fait « avancer
// l'horloge » en passant une autre date. Une machine à remonter le
// temps de poche, réservée aux tests.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { sendMailMock } from './setup.js';
import { seedUser, seedProposal, seedSurvey, buildUser, extractTokenFromEmail, makeAdminUser, makeCitizen } from './helpers.js';
import {
  purgeExpiredTokens, warnInactiveAccounts, deleteInactiveAccounts, runRetention,
} from '../src/services/retention.js';

const NOW = new Date('2030-06-15T03:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(NOW.getTime() - ms);
const yearsAgo = (years, extraDays = 0) => {
  const d = new Date(NOW);
  d.setFullYear(d.getFullYear() - years);
  return new Date(d.getTime() - extraDays * DAY);
};

describe('purgeExpiredTokens', () => {
  it('efface les jetons expirés ou utilisés depuis plus de 24 h, garde les autres', async () => {
    const user = await seedUser();
    const base = { userId: user.id, type: 'VERIFY_EMAIL' };
    await prisma.authToken.createMany({
      data: [
        { ...base, tokenHash: 'expire-depuis-2-jours', expiresAt: ago(2 * DAY) },
        { ...base, tokenHash: 'utilise-depuis-2-jours', expiresAt: new Date(NOW.getTime() + DAY), usedAt: ago(2 * DAY) },
        { ...base, tokenHash: 'expire-depuis-1-heure', expiresAt: ago(60 * 60 * 1000) },
        { ...base, tokenHash: 'encore-valide', expiresAt: new Date(NOW.getTime() + DAY) },
      ],
    });

    const deleted = await purgeExpiredTokens({ now: NOW });

    expect(deleted).toBe(2);
    const left = (await prisma.authToken.findMany()).map((t) => t.tokenHash).sort();
    expect(left).toEqual(['encore-valide', 'expire-depuis-1-heure']);
  });
});

describe('warnInactiveAccounts', () => {
  it('prévient un compte qui atteindra 3 ans sans connexion dans moins de 30 jours', async () => {
    const sleeping = await seedUser({ lastLoginAt: yearsAgo(3, -10) }); // 3 ans moins 10 jours
    const active = await seedUser({ lastLoginAt: ago(10 * DAY) });

    const result = await warnInactiveAccounts({ now: NOW });

    expect(result).toEqual({ warned: 1, failed: 0 });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe(sleeping.email);
    expect(sendMailMock.mock.calls[0][0].subject).toMatch(/bientôt supprimé/);

    const [s, a] = await Promise.all([
      prisma.user.findUnique({ where: { id: sleeping.id } }),
      prisma.user.findUnique({ where: { id: active.id } }),
    ]);
    expect(s.inactivityWarnedAt).toEqual(NOW);
    expect(a.inactivityWarnedAt).toBeNull();
  });

  it("compte l'inactivité depuis la création pour un compte qui ne s'est jamais connecté depuis l'ajout du suivi", async () => {
    await seedUser({ lastLoginAt: null, createdAt: yearsAgo(4) });
    const result = await warnInactiveAccounts({ now: NOW });
    expect(result.warned).toBe(1);
  });

  it("ne prévient pas deux fois, ni un administrateur", async () => {
    await seedUser({ lastLoginAt: yearsAgo(4), inactivityWarnedAt: ago(5 * DAY) });
    await seedUser({ lastLoginAt: yearsAgo(4), role: 'ADMIN' });

    const result = await warnInactiveAccounts({ now: NOW });

    expect(result.warned).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("si l'email ne part pas, le compte n'est PAS marqué prévenu (retenté au passage suivant)", async () => {
    const user = await seedUser({ lastLoginAt: yearsAgo(4) });
    sendMailMock.mockRejectedValueOnce(new Error('SMTP indisponible'));

    const result = await warnInactiveAccounts({ now: NOW });

    expect(result).toEqual({ warned: 0, failed: 1 });
    const inDb = await prisma.user.findUnique({ where: { id: user.id } });
    expect(inDb.inactivityWarnedAt).toBeNull();
  });
});

describe('deleteInactiveAccounts', () => {
  it('supprime un compte inactif depuis 3 ans ET prévenu depuis au moins 30 jours', async () => {
    const user = await seedUser({ lastLoginAt: yearsAgo(3, 1), inactivityWarnedAt: ago(31 * DAY) });
    expect(await deleteInactiveAccounts({ now: NOW })).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it('ne supprime jamais un compte non prévenu, prévenu depuis moins de 30 jours, ou administrateur', async () => {
    await seedUser({ lastLoginAt: yearsAgo(5) }); // jamais prévenu (ex. échec SMTP)
    await seedUser({ lastLoginAt: yearsAgo(5), inactivityWarnedAt: ago(10 * DAY) });
    await seedUser({ lastLoginAt: yearsAgo(5), inactivityWarnedAt: ago(60 * DAY), role: 'ADMIN' });

    expect(await deleteInactiveAccounts({ now: NOW })).toBe(0);
    expect(await prisma.user.count()).toBe(3);
  });

  it('applique les mêmes règles que « Supprimer mon compte » : votes effacés, réponses anonymisées', async () => {
    const user = await seedUser({ lastLoginAt: yearsAgo(4), inactivityWarnedAt: ago(40 * DAY) });
    const proposal = await seedProposal();
    const survey = await seedSurvey();
    await prisma.vote.create({ data: { userId: user.id, proposalId: proposal.id, value: 'POUR' } });
    const response = await prisma.surveyResponse.create({ data: { userId: user.id, surveyId: survey.id } });

    await deleteInactiveAccounts({ now: NOW });

    expect(await prisma.vote.count()).toBe(0);
    const anonymised = await prisma.surveyResponse.findUnique({ where: { id: response.id } });
    expect(anonymised).not.toBeNull();
    expect(anonymised.userId).toBeNull();
  });
});

describe('runRetention — le cycle complet dans le temps', () => {
  it('jour J : avertissement ; J+30 : suppression — sauf si la personne revient entre-temps', async () => {
    const leaving = await seedUser({ lastLoginAt: yearsAgo(3, -5) });  // atteint 3 ans dans 5 jours
    const returning = await seedUser({ lastLoginAt: yearsAgo(3, -5) });

    // Jour J : les deux sont prévenus, personne n'est supprimé
    const day0 = await runRetention({ now: NOW });
    expect(day0).toMatchObject({ deletedAccounts: 0, warnedAccounts: 2 });

    // Entre-temps, l'une des deux se reconnecte (ce que fait login())
    await prisma.user.update({
      where: { id: returning.id },
      data: { lastLoginAt: new Date(NOW.getTime() + 3 * DAY), inactivityWarnedAt: null },
    });

    // J+30 : seule celle qui n'est pas revenue est supprimée
    const day30 = await runRetention({ now: new Date(NOW.getTime() + 30 * DAY) });
    expect(day30.deletedAccounts).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: leaving.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: returning.id } })).not.toBeNull();
  });

  it("--dry-run : compte tout, ne supprime rien, n'envoie rien", async () => {
    await seedUser({ lastLoginAt: yearsAgo(4), inactivityWarnedAt: ago(40 * DAY) });
    await seedUser({ lastLoginAt: yearsAgo(4) });

    const report = await runRetention({ now: NOW, dryRun: true });

    expect(report).toMatchObject({ dryRun: true, deletedAccounts: 1, warnedAccounts: 1 });
    expect(await prisma.user.count()).toBe(2);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe('Suivi de la dernière connexion', () => {
  it("se connecter met à jour lastLoginAt et annule un avertissement d'inactivité", async () => {
    const credentials = buildUser();
    await request(app).post('/api/v1/auth/register').send(credentials);
    const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    await request(app).post('/api/v1/auth/verify-email').send({ token: verifyToken });
    await prisma.user.update({
      where: { email: credentials.email },
      data: { lastLoginAt: new Date('2020-01-01'), inactivityWarnedAt: new Date('2022-12-01') },
    });

    const before = Date.now();
    const res = await request(app).post('/api/v1/auth/login').send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: credentials.email } });
    expect(user.lastLoginAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(user.inactivityWarnedAt).toBeNull();
  });

  it("un administrateur n'est compté connecté qu'APRÈS le code 2FA", async () => {
    const { user } = await makeAdminUser(); // parcours complet : mot de passe + code
    const inDb = await prisma.user.findUnique({ where: { id: user.id } });
    expect(inDb.lastLoginAt).not.toBeNull();
  });

  it("un mauvais mot de passe ne compte pas comme une connexion", async () => {
    // Vrai compte (vrai hash Argon2) : seedUser a un hash factice,
    // que argon2.verify refuserait avant même de comparer.
    const { user } = await makeCitizen();
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: null } });

    const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'MauvaisMotDePasse1!' });
    expect(res.status).toBe(401);
    const inDb = await prisma.user.findUnique({ where: { id: user.id } });
    expect(inDb.lastLoginAt).toBeNull();
  });
});
