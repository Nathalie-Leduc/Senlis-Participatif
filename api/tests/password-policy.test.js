// ══════════════════════════════════════════════════════════
// S5R-13b — politique des mots de passe CNIL + NIST combinée
//
// Document 21, § 8.5 :
//  - 15 caractères minimum, aucune règle de composition ;
//  - refus des mots de passe courants, prévisibles ou personnels ;
//  - longueur en caractères Unicode, normalisation NFC ;
//  - 10 essais par heure et par compte, alerte au titulaire ;
//  - rappel annuel de changer de mot de passe, pour l'équipe seulement.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { sendMailMock } from './setup.js';
import {
  buildUser, extractTokenFromEmail, makeCitizen, makeAdminUser,
} from './helpers.js';
import {
  passwordProblem, codePointLength, normalizePassword, MESSAGES, EXAMPLE_PASSPHRASE,
} from '../src/lib/passwordPolicy.js';
import { throttleKey, MAX_FAILURES, WINDOW_MS } from '../src/services/loginThrottle.js';
import { purgeExpiredThrottles } from '../src/services/retention.js';
import { passwordRenewalDue } from '../src/controllers/authController.js';

const API = '/api/v1/auth';

/** Inscrit ET vérifie un compte, renvoie ses identifiants */
async function registerVerified(overrides = {}) {
  const credentials = buildUser(overrides);
  const res = await request(app).post(`${API}/register`).send(credentials);
  expect(res.status).toBe(201);
  const token = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
  await request(app).post(`${API}/verify-email`).send({ token });
  return credentials;
}

const login = (email, password) => request(app).post(`${API}/login`).send({ email, password });

// ── La règle elle-même (fonction pure) ──────────────────────
describe('passwordProblem — la règle', () => {
  it('accepte 15 caractères sans aucune règle de composition (minuscules seules)', () => {
    expect(passwordProblem('lanterne remparts tilleul')).toBeNull();
    expect(passwordProblem('quinzecaractere')).toBeNull(); // exactement 15
  });

  it('refuse moins de 15 caractères, et plus de 128', () => {
    expect(passwordProblem('quatorzecaract')).toBe(MESSAGES.tooShort); // 14
    expect(passwordProblem('a b c d e f g h i j k l m n o '.repeat(5))).toBe(MESSAGES.tooLong);
  });

  it('compte les caractères tels qu\'on les voit (un emoji = 1), pas les unités UTF-16', () => {
    expect('🦌'.length).toBe(2);
    expect(codePointLength('🦌')).toBe(1);
    // 14 caractères visibles, dont un emoji : refusé, alors que .length dirait 15
    expect(passwordProblem('tilleul orag 🦌')).toBe(MESSAGES.tooShort);
  });

  it('normalise en NFC : « é » en un ou deux caractères, c\'est le même mot de passe', () => {
    const decomposed = 'café des remparts'; // e + accent combinant
    const composed = 'café des remparts';
    expect(decomposed).not.toBe(composed);
    expect(normalizePassword(decomposed)).toBe(composed);
  });

  it('refuse les mots de passe courants de la liste locale, même avec majuscules et espaces', () => {
    expect(passwordProblem('iloveyouforever')).toBe(MESSAGES.common);
    expect(passwordProblem('I Love You Forever')).toBe(MESSAGES.common);
    expect(passwordProblem('passwordpassword')).toBe(MESSAGES.common);
  });

  it('refuse les mots « attendus ici » : le nom du site, même habillé de chiffres', () => {
    expect(passwordProblem('Senlis2026!!!!!!')).toBe(MESSAGES.common);
    expect(passwordProblem('senlis senlis senlis')).toBe(MESSAGES.common);
    expect(passwordProblem('Senlis-Participatif-2026')).toBe(MESSAGES.common);
  });

  it('refuse la phrase d\'exemple affichée sous le champ, en entier ou en partie', () => {
    expect(passwordProblem(EXAMPLE_PASSPHRASE)).toBe(MESSAGES.common);
    expect(passwordProblem('Pivoine-Lanterne-Orage')).toBe(MESSAGES.common);
    expect(passwordProblem('pivoine lanterne orage remparts 2026')).toBe(MESSAGES.common);
  });

  it('refuse les suites de touches et les répétitions', () => {
    expect(passwordProblem('azertyuiopqsdfghj')).toBe(MESSAGES.predictable);
    expect(passwordProblem('abcabcabcabcabcabc')).toBe(MESSAGES.predictable);
    expect(passwordProblem('zyxwvutsrqponmlk')).toBe(MESSAGES.predictable);
  });

  it('refuse un mot de passe qui reprend l\'adresse email ou le pseudo', () => {
    const person = { email: 'nathalie.leduc@exemple.fr', pseudo: 'Remparts60' };
    expect(passwordProblem('Nathalie-Leduc-2026', person)).toBe(MESSAGES.personal);
    expect(passwordProblem('nathalie.leduc@exemple.fr', person)).toBe(MESSAGES.personal);
    expect(passwordProblem('remparts60remparts60', person)).toBe(MESSAGES.personal);
    // Sans la personne, ce contrôle est sauté
    expect(passwordProblem('Nathalie-Leduc-2026')).toBeNull();
    // Contenir son prénom dans une vraie phrase reste permis
    expect(passwordProblem('nathalie aime les tilleuls', person)).toBeNull();
  });
});

// ── Inscription, réinitialisation, changement ────────────────
describe('Nouvelle règle appliquée par l\'API', () => {
  it('inscription : 400 avec un message clair si trop court (plus aucune exigence de majuscule ou de chiffre)', async () => {
    const res = await request(app).post(`${API}/register`).send(buildUser({ password: 'Court1!' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.password).toBe(MESSAGES.tooShort);
  });

  it('inscription : refuse un mot de passe courant', async () => {
    const res = await request(app).post(`${API}/register`).send(buildUser({ password: 'iloveyouforever' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.password).toBe(MESSAGES.common);
  });

  it('inscription : refuse un mot de passe qui reprend l\'adresse email', async () => {
    const res = await request(app).post(`${API}/register`)
      .send(buildUser({ email: 'jeanne.martin@senlis-test.fr', password: 'JeanneMartin2026' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.password).toBe(MESSAGES.personal);
  });

  it('un mot de passe saisi avec des accents décomposés s\'ouvre aussi avec les accents composés', async () => {
    const credentials = await registerVerified({ password: 'café des remparts' });
    const res = await login(credentials.email, 'café des remparts');
    expect(res.status).toBe(200);
  });

  it('un ancien compte (règle de 2025, haché sans normalisation) se connecte toujours', async () => {
    // Mot de passe à l'ancienne mode — 12 caractères, 4 familles — haché
    // en forme DÉCOMPOSÉE, comme le faisait l'API avant S5R-13b
    const argon2 = (await import('argon2')).default;
    const old = 'Été-2025!';
    await prisma.user.create({
      data: {
        email: 'ancien@senlis-test.fr', pseudo: 'ancien', emailVerified: true,
        passwordHash: await argon2.hash(old),
      },
    });
    expect((await login('ancien@senlis-test.fr', old)).status).toBe(200);
  });

  it('changement : refuse un nouveau mot de passe qui reprend le pseudo', async () => {
    const { token } = await makeCitizen();
    const me = await request(app).get(`${API}/me`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).put(`${API}/me/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: buildUser().password, newPassword: `${me.body.user.pseudo}${me.body.user.pseudo}2026` });
    expect(res.status).toBe(400);
    expect(res.body.error.details.newPassword).toBe(MESSAGES.personal);
  });

  it('réinitialisation refusée (mot de passe personnel) : le lien reçu reste valable', async () => {
    const credentials = await registerVerified({ email: 'paul.durand@senlis-test.fr' });
    await request(app).post(`${API}/forgot-password`).send({ email: credentials.email });
    const resetToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);

    const refused = await request(app).post(`${API}/reset-password`)
      .send({ token: resetToken, password: 'Paul-Durand-2026' });
    expect(refused.status).toBe(400);
    expect(refused.body.error.details.password).toBe(MESSAGES.personal);

    // Même lien, meilleur mot de passe : accepté
    const accepted = await request(app).post(`${API}/reset-password`)
      .send({ token: resetToken, password: 'vélo cerisier brouillard' });
    expect(accepted.status).toBe(200);
    expect((await login(credentials.email, 'vélo cerisier brouillard')).status).toBe(200);
  });
});

// ── 10 essais par heure et par compte ────────────────────────
describe('Limite de 10 essais par heure et par compte', () => {
  it(`après ${MAX_FAILURES} échecs, même le BON mot de passe est refusé (429), et le titulaire est prévenu une fois`, async () => {
    const credentials = await registerVerified();
    sendMailMock.mockClear();

    for (let i = 0; i < MAX_FAILURES; i += 1) {
      expect((await login(credentials.email, 'pas le bon mot de passe')).status).toBe(401);
    }
    const blocked = await login(credentials.email, credentials.password);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('ACCOUNT_THROTTLED');
    expect(blocked.body.error.message).toMatch(/Mot de passe oublié/);

    // Une seule alerte, au 10e échec ; la 11e tentative n'en renvoie pas
    const alerts = sendMailMock.mock.calls.filter(([mail]) => /Essais de connexion/.test(mail.subject));
    expect(alerts).toHaveLength(1);
    expect(alerts[0][0].to).toBe(credentials.email);
    // L'alerte ne contient aucun lien (anti-hameçonnage)
    expect(alerts[0][0].html).not.toMatch(/href=/);
  });

  it('une adresse inconnue est bloquée pareil (sinon le blocage trahirait les comptes existants), sans email', async () => {
    sendMailMock.mockClear();
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      expect((await login('inconnue@senlis-test.fr', 'nimporte quoi du tout')).status).toBe(401);
    }
    expect((await login('inconnue@senlis-test.fr', 'nimporte quoi du tout')).status).toBe(429);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('une connexion réussie remet le compteur à zéro', async () => {
    const credentials = await registerVerified();
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) await login(credentials.email, 'pas le bon mot de passe');
    expect((await login(credentials.email, credentials.password)).status).toBe(200);
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) await login(credentials.email, 'pas le bon mot de passe');
    expect((await login(credentials.email, 'pas le bon mot de passe')).status).toBe(401); // 10e échec : pas encore bloqué
  });

  it('au bout d\'une heure, le compte se rouvre', async () => {
    const credentials = await registerVerified();
    for (let i = 0; i < MAX_FAILURES; i += 1) await login(credentials.email, 'pas le bon mot de passe');
    expect((await login(credentials.email, credentials.password)).status).toBe(429);

    // « Voyage dans le temps » : la fenêtre a commencé il y a 61 minutes
    await prisma.loginThrottle.update({
      where: { key: throttleKey(credentials.email) },
      data: { windowStart: new Date(Date.now() - WINDOW_MS - 60000) },
    });
    expect((await login(credentials.email, credentials.password)).status).toBe(200);
  });

  it('choisir un nouveau mot de passe (« Mot de passe oublié ») lève le blocage', async () => {
    const credentials = await registerVerified();
    for (let i = 0; i < MAX_FAILURES; i += 1) await login(credentials.email, 'pas le bon mot de passe');

    await request(app).post(`${API}/forgot-password`).send({ email: credentials.email });
    const resetToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    await request(app).post(`${API}/reset-password`).send({ token: resetToken, password: 'vélo cerisier brouillard' });

    expect((await login(credentials.email, 'vélo cerisier brouillard')).status).toBe(200);
  });

  it('l\'adresse n\'est jamais stockée en clair (empreinte HMAC)', async () => {
    await login('quelquun@senlis-test.fr', 'pas le bon mot de passe');
    const rows = await prisma.loginThrottle.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].key).not.toContain('quelquun');
    expect(rows[0].failures).toBe(1);
  });

  it('la tâche de nuit efface les compteurs de plus d\'une heure', async () => {
    const now = new Date();
    await prisma.loginThrottle.createMany({
      data: [
        { key: 'recent', failures: 3, windowStart: new Date(now.getTime() - 10 * 60000) },
        { key: 'ancien', failures: 3, windowStart: new Date(now.getTime() - WINDOW_MS - 60000) },
      ],
    });
    expect(await purgeExpiredThrottles({ now })).toBe(1);
    expect((await prisma.loginThrottle.findMany()).map((r) => r.key)).toEqual(['recent']);
  });
});

// ── Rappel annuel : l'équipe seulement ───────────────────────
describe('Rappel annuel de changer de mot de passe (comptes de l\'équipe)', () => {
  const OVER_A_YEAR = new Date(Date.now() - 400 * 24 * 3600 * 1000);

  it('la règle : équipe et plus d\'un an → rappel ; citoyen → jamais', () => {
    expect(passwordRenewalDue({ role: 'ADMIN', createdAt: OVER_A_YEAR, passwordChangedAt: null })).toBe(true);
    expect(passwordRenewalDue({ role: 'EDITOR', createdAt: OVER_A_YEAR, passwordChangedAt: OVER_A_YEAR })).toBe(true);
    expect(passwordRenewalDue({ role: 'ADMIN', createdAt: OVER_A_YEAR, passwordChangedAt: new Date() })).toBe(false);
    expect(passwordRenewalDue({ role: 'CITIZEN', createdAt: OVER_A_YEAR, passwordChangedAt: null })).toBe(false);
  });

  it('GET /auth/me l\'indique à un admin, et le changement de mot de passe l\'efface', async () => {
    const { user, token } = await makeAdminUser();
    expect(user.passwordRenewalDue).toBe(false);
    await prisma.user.update({ where: { id: user.id }, data: { createdAt: OVER_A_YEAR } });

    const me = await request(app).get(`${API}/me`).set('Authorization', `Bearer ${token}`);
    expect(me.body.user.passwordRenewalDue).toBe(true);
    expect(me.body.user).not.toHaveProperty('passwordChangedAt'); // la date reste interne

    const changed = await request(app).put(`${API}/me/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: buildUser().password, newPassword: 'vélo cerisier brouillard' });
    expect(changed.status).toBe(200);
    const after = await request(app).get(`${API}/me`).set('Authorization', `Bearer ${changed.body.token}`);
    expect(after.body.user.passwordRenewalDue).toBe(false);
  });
});
