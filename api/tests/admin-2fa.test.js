// ══════════════════════════════════════════════════════════
// Tests — Double authentification (2FA) email, comptes admin
// (Sprint 5, S5-03)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
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
