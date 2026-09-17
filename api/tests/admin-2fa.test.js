// ══════════════════════════════════════════════════════════
// Tests — Double authentification (2FA) email, comptes admin
// (Sprint 5, S5-03)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { sendMailMock } from './setup.js';
import {
  buildUser, makeCitizen, makeAdminUser, extractTokenFromEmail, extractTwoFactorCodeFromEmail,
} from './helpers.js';

const API = '/api/v1/auth';

// Reproduit les deux premières étapes de makeAdminUser() (inscription
// + vérification + promotion), SANS jouer le login — pour les tests
// qui veulent observer précisément ce que /login renvoie en premier,
// plutôt que de passer par le helper qui va jusqu'au bout du parcours.
async function createAdminAccount() {
  const credentials = buildUser();
  await request(app).post(`${API}/register`).send(credentials);

  const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
  await request(app).post(`${API}/verify-email`).send({ token: verifyToken });

  await prisma.user.update({ where: { email: credentials.email }, data: { role: 'ADMIN' } });

  return credentials;
}

describe('2FA admin — connexion', () => {
  it('un citoyen normal se connecte directement, sans étape 2FA', async () => {
    // makeCitizen() suit déjà tout le parcours ; s'il renvoie bien un
    // token exploitable, c'est la preuve que /login lui a répondu
    // directement (pas de twoFactorRequired dans le chemin).
    const { token } = await makeCitizen();
    expect(token).toBeTruthy();

    const res = await request(app).get(`${API}/me`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('un admin reçoit un jeton de défi + un code par email, jamais le JWT directement', async () => {
    const credentials = await createAdminAccount();

    const res = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.challengeToken).toBeTruthy();
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toBeUndefined();

    // L'email envoyé porte bien un code à 6 chiffres dans son sujet.
    const lastMail = sendMailMock.mock.calls.at(-1)[0];
    expect(lastMail.to).toBe(credentials.email);
    expect(lastMail.subject).toMatch(/^\d{6} —/);
  });

  it('un bon code termine la connexion et renvoie un vrai JWT admin', async () => {
    const { token, user } = await makeAdminUser();

    expect(token).toBeTruthy();
    expect(user.role).toBe('ADMIN');

    const res = await request(app).get(`${API}/me`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('400 INVALID_CODE — un code incorrect est refusé', async () => {
    const credentials = await createAdminAccount();
    const loginRes = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password });

    const res = await request(app)
      .post(`${API}/2fa/verify`)
      .send({ challengeToken: loginRes.body.challengeToken, code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  it('400 INVALID_CODE — un code déjà utilisé ne peut pas resservir (usage unique)', async () => {
    const credentials = await createAdminAccount();
    const loginRes = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password });
    const code = extractTwoFactorCodeFromEmail(sendMailMock.mock.calls.at(-1)[0]);

    const first = await request(app)
      .post(`${API}/2fa/verify`)
      .send({ challengeToken: loginRes.body.challengeToken, code });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`${API}/2fa/verify`)
      .send({ challengeToken: loginRes.body.challengeToken, code });
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('INVALID_CODE');
  });

  it("401 CHALLENGE_EXPIRED — un jeton de session normal ne peut pas servir de jeton de défi", async () => {
    // Un citoyen (donc un VRAI JWT de session, sans "purpose") tente
    // de l'utiliser là où seul un jeton de défi 2FA est attendu.
    const { token: sessionToken } = await makeCitizen();

    const res = await request(app)
      .post(`${API}/2fa/verify`)
      .send({ challengeToken: sessionToken, code: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('CHALLENGE_EXPIRED');
  });

  it("401 — un jeton de défi 2FA ne permet pas d'accéder à une route protégée normale", async () => {
    // C'est le garde-fou de verifyToken() (lib/jwt.js) : un jeton
    // portant "purpose" est catégoriquement refusé par le middleware
    // auth(), même s'il est signé avec le bon secret et pas expiré.
    const credentials = await createAdminAccount();
    const loginRes = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password });

    const res = await request(app)
      .get(`${API}/me`)
      .set('Authorization', `Bearer ${loginRes.body.challengeToken}`);

    expect(res.status).toBe(401);
  });
});

describe('2FA admin — appareil de confiance (S5-20)', () => {
  it('un code réussi renvoie aussi un jeton "appareil de confiance"', async () => {
    const credentials = await createAdminAccount();
    const loginRes = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password });
    const code = extractTwoFactorCodeFromEmail(sendMailMock.mock.calls.at(-1)[0]);

    const res = await request(app)
      .post(`${API}/2fa/verify`)
      .send({ challengeToken: loginRes.body.challengeToken, code });

    expect(res.status).toBe(200);
    expect(res.body.trustedDeviceToken).toBeTruthy();
  });

  it('un jeton valide dispense du code à la connexion suivante, sur ce même compte', async () => {
    // makeAdminUser() va jusqu'au bout du parcours mais ne renvoie
    // pas le trustedDeviceToken obtenu au passage — on reconstruit
    // le parcours à la main ici pour garder la main sur le mot de
    // passe en clair (nécessaire pour login() juste après).
    const built = buildUser();
    await request(app).post(`${API}/register`).send(built);
    const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    await request(app).post(`${API}/verify-email`).send({ token: verifyToken });
    await prisma.user.update({ where: { email: built.email }, data: { role: 'ADMIN' } });

    const firstLogin = await request(app)
      .post(`${API}/login`)
      .send({ email: built.email, password: built.password });
    const code = extractTwoFactorCodeFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    const verifyRes = await request(app)
      .post(`${API}/2fa/verify`)
      .send({ challengeToken: firstLogin.body.challengeToken, code });
    const { trustedDeviceToken } = verifyRes.body;

    // Deuxième connexion, "nouveau navigateur" simulé par le fait
    // qu'on ne rejoue PAS 2fa/verify cette fois — seul login() est
    // appelé, avec le jeton de confiance en plus.
    const secondLogin = await request(app)
      .post(`${API}/login`)
      .send({ email: built.email, password: built.password, trustedDeviceToken });

    expect(secondLogin.status).toBe(200);
    expect(secondLogin.body.twoFactorRequired).toBeFalsy();
    expect(secondLogin.body.token).toBeTruthy();
    expect(secondLogin.body.user.role).toBe('ADMIN');
  });

  it('un jeton falsifié ou invalide ne dispense pas du code (retombe sur le 2FA normal)', async () => {
    const credentials = await createAdminAccount();

    const res = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password, trustedDeviceToken: 'ceci-nest-pas-un-jeton-valide' });

    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.token).toBeUndefined();
  });

  it("le jeton de confiance d'UN compte ne dispense pas du 2FA sur un AUTRE compte", async () => {
    const { trustedDeviceToken } = await (async () => {
      const built = buildUser();
      await request(app).post(`${API}/register`).send(built);
      const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
      await request(app).post(`${API}/verify-email`).send({ token: verifyToken });
      await prisma.user.update({ where: { email: built.email }, data: { role: 'ADMIN' } });
      const loginRes = await request(app)
        .post(`${API}/login`)
        .send({ email: built.email, password: built.password });
      const code = extractTwoFactorCodeFromEmail(sendMailMock.mock.calls.at(-1)[0]);
      const verifyRes = await request(app)
        .post(`${API}/2fa/verify`)
        .send({ challengeToken: loginRes.body.challengeToken, code });
      return verifyRes.body;
    })();

    // Un SECOND admin, complètement différent, tente d'utiliser le
    // jeton de confiance du PREMIER — ne doit surtout pas marcher,
    // sinon n'importe quel admin pourrait dispenser du 2FA de
    // n'importe quel autre compte avec son propre jeton.
    const otherCredentials = await createAdminAccount();
    const res = await request(app)
      .post(`${API}/login`)
      .send({ email: otherCredentials.email, password: otherCredentials.password, trustedDeviceToken });

    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
  });

  it('un jeton de confiance expiré ne dispense pas du code', async () => {
    const credentials = await createAdminAccount();
    const user = await prisma.user.findUnique({ where: { email: credentials.email } });

    // Fabriqué directement (plutôt que d'attendre une vraie heure
    // d'expiration) : même secret et même "purpose" que la vraie
    // fonction signTrustedDeviceToken, juste avec une durée de vie
    // déjà passée.
    const expiredToken = jwt.sign(
      { userId: user.id, purpose: 'TRUSTED_DEVICE' },
      process.env.JWT_SECRET,
      { expiresIn: '-10s' },
    );

    const res = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password, trustedDeviceToken: expiredToken });

    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
  });

  it("un vrai jeton de SESSION (sans purpose) n'est pas accepté comme jeton de confiance", async () => {
    // Même idée que le test "CHALLENGE_EXPIRED" plus haut : un jeton
    // qui n'a jamais eu vocation à servir ici (purpose absent) doit
    // être rejeté, pas accepté par accident parce qu'il est bien
    // signé avec le bon secret.
    const { token: citizenSessionToken } = await makeCitizen();
    const credentials = await createAdminAccount();

    const res = await request(app)
      .post(`${API}/login`)
      .send({ email: credentials.email, password: credentials.password, trustedDeviceToken: citizenSessionToken });

    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
  });
});
