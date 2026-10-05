// ══════════════════════════════════════════════════════════
// Tests d'intégration — Durcissement de l'authentification (S5A-06)
//
// Fil rouge : une session volée (ordinateur resté ouvert, jeton
// dérobé) ou un mot de passe deviné ne doivent jamais suffire à
// prendre, verrouiller ou détruire un compte.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { sendMailMock } from './setup.js';
import {
  buildUser, makeCitizen, extractTokenFromEmail, extractTwoFactorCodeFromEmail,
} from './helpers.js';
import { MAX_TWO_FACTOR_ATTEMPTS } from '../src/services/token.js';
import { maskEmail } from '../src/services/email.js';

const AUTH = '/api/v1/auth';
const PASSWORD = buildUser().password; // mot de passe commun à tous les comptes de test

/** Un admin vérifié, arrêté à l'étape du code 2FA (pas encore connecté). */
async function adminAtTwoFactorStep() {
  const credentials = buildUser();
  await request(app).post(`${AUTH}/register`).send(credentials);
  const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
  await request(app).post(`${AUTH}/verify-email`).send({ token: verifyToken });
  await prisma.user.update({ where: { email: credentials.email }, data: { role: 'ADMIN' } });

  const login = await request(app).post(`${AUTH}/login`).send({ email: credentials.email, password: credentials.password });
  const code = extractTwoFactorCodeFromEmail(sendMailMock.mock.calls.at(-1)[0]);
  return { credentials, challengeToken: login.body.challengeToken, code };
}

/** Un code forcément faux : le vrai + 1 (modulo 1 000 000). */
const wrongCode = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

describe('Code 2FA — nombre d\'essais limité', () => {
  it(`invalide le code au ${MAX_TWO_FACTOR_ATTEMPTS}e essai raté — même le bon code ne passe plus ensuite`, async () => {
    const { challengeToken, code } = await adminAtTwoFactorStep();

    for (let i = 1; i < MAX_TWO_FACTOR_ATTEMPTS; i++) {
      const res = await request(app).post(`${AUTH}/2fa/verify`).send({ challengeToken, code: wrongCode(code) });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CODE');
      // Le message dit combien il reste d'essais
      expect(res.body.error.message).toMatch(new RegExp(`encore ${MAX_TWO_FACTOR_ATTEMPTS - i} essai`));
    }

    const last = await request(app).post(`${AUTH}/2fa/verify`).send({ challengeToken, code: wrongCode(code) });
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('TOO_MANY_ATTEMPTS');

    // Le vrai code est désormais inutilisable
    const tooLate = await request(app).post(`${AUTH}/2fa/verify`).send({ challengeToken, code });
    expect(tooLate.status).toBe(400);
    expect(tooLate.body.token).toBeUndefined();
  });

  it('se reconnecter envoie un nouveau code, qui fonctionne', async () => {
    const { credentials, challengeToken, code } = await adminAtTwoFactorStep();
    for (let i = 0; i < MAX_TWO_FACTOR_ATTEMPTS; i++) {
      await request(app).post(`${AUTH}/2fa/verify`).send({ challengeToken, code: wrongCode(code) });
    }

    const login = await request(app).post(`${AUTH}/login`).send({ email: credentials.email, password: credentials.password });
    const newCode = extractTwoFactorCodeFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    const res = await request(app).post(`${AUTH}/2fa/verify`).send({ challengeToken: login.body.challengeToken, code: newCode });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('une rafale de mauvais codes envoyés EN MÊME TEMPS est bien comptée (compteur atomique)', async () => {
    const { challengeToken, code } = await adminAtTwoFactorStep();

    await Promise.all(
      Array.from({ length: MAX_TWO_FACTOR_ATTEMPTS }, () =>
        request(app).post(`${AUTH}/2fa/verify`).send({ challengeToken, code: wrongCode(code) })),
    );

    const res = await request(app).post(`${AUTH}/2fa/verify`).send({ challengeToken, code });
    expect(res.status).not.toBe(200);
  });
});

describe('Révocation des sessions après un changement de mot de passe', () => {
  it("changer son mot de passe déconnecte les AUTRES sessions, pas la session courante", async () => {
    const { user, token: otherDevice } = await makeCitizen();
    // Deuxième connexion = deuxième appareil
    const login = await request(app).post(`${AUTH}/login`).send({ email: user.email, password: PASSWORD });
    const thisDevice = login.body.token;

    const res = await request(app)
      .put(`${AUTH}/me/password`)
      .set('Authorization', `Bearer ${thisDevice}`)
      .send({ currentPassword: PASSWORD, newPassword: 'NouveauMotDePasse456!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();

    // L'autre appareil est déconnecté, avec un code explicite
    const other = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${otherDevice}`);
    expect(other.status).toBe(401);
    expect(other.body.error.code).toBe('SESSION_REVOKED');

    // L'ANCIEN jeton de cet appareil aussi…
    const oldHere = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${thisDevice}`);
    expect(oldHere.status).toBe(401);

    // …mais le NOUVEAU jeton renvoyé par l'API, lui, fonctionne
    const newHere = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${res.body.token}`);
    expect(newHere.status).toBe(200);
  });

  it('réinitialiser son mot de passe (« mot de passe oublié ») révoque TOUTES les sessions', async () => {
    const { user, token } = await makeCitizen();

    await request(app).post(`${AUTH}/forgot-password`).send({ email: user.email });
    const resetToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
    const reset = await request(app).post(`${AUTH}/reset-password`).send({ token: resetToken, password: 'NouveauMotDePasse456!' });
    expect(reset.status).toBe(200);

    const res = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_REVOKED');
  });

  it("un jeton émis AVANT S5A-06 (sans champ tv) reste valide tant que le mot de passe n'a pas changé", async () => {
    const { user } = await makeCitizen();
    const legacy = jwt.sign({ userId: user.id, role: 'CITIZEN' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

    const res = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${legacy}`);
    expect(res.status).toBe(200);
  });
});

describe('Mot de passe exigé pour les actions sensibles', () => {
  it("changer d'email sans le mot de passe actuel → 401, et l'email ne change pas", async () => {
    const { user, token } = await makeCitizen();

    const res = await request(app)
      .patch(`${AUTH}/me`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'intrus@exemple.fr' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    const inDb = await prisma.user.findUnique({ where: { id: user.id } });
    expect(inDb.email).toBe(user.email);
  });

  it("changer d'email AVEC le bon mot de passe fonctionne (et redemande une vérification)", async () => {
    const { user, token } = await makeCitizen();

    const res = await request(app)
      .patch(`${AUTH}/me`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'nouvelle-adresse@exemple.fr', currentPassword: PASSWORD });

    expect(res.status).toBe(200);
    const inDb = await prisma.user.findUnique({ where: { id: user.id } });
    expect(inDb.email).toBe('nouvelle-adresse@exemple.fr');
    expect(inDb.emailVerified).toBe(false);
  });

  it("renvoyer son email ACTUEL n'est pas un changement : aucun mot de passe exigé", async () => {
    const { user, token } = await makeCitizen();
    const res = await request(app)
      .patch(`${AUTH}/me`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: user.email, pseudo: 'nouveaupseudo' });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('supprimer son compte sans mot de passe → 400, avec un mauvais → 401 ; le compte existe toujours', async () => {
    const { user, token } = await makeCitizen();

    const none = await request(app).delete(`${AUTH}/me`).set('Authorization', `Bearer ${token}`);
    expect(none.status).toBe(400);

    const wrong = await request(app).delete(`${AUTH}/me`).set('Authorization', `Bearer ${token}`).send({ password: 'PasLeBon123!' });
    expect(wrong.status).toBe(401);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it('supprimer son compte avec le bon mot de passe → 204', async () => {
    const { user, token } = await makeCitizen();
    const res = await request(app).delete(`${AUTH}/me`).set('Authorization', `Bearer ${token}`).send({ password: PASSWORD });
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });
});

describe('Anti-énumération et minimisation', () => {
  it("un email inconnu reçoit exactement la même réponse qu'un mauvais mot de passe", async () => {
    const { user } = await makeCitizen();
    const unknown = await request(app).post(`${AUTH}/login`).send({ email: 'personne@exemple.fr', password: PASSWORD });
    const wrong = await request(app).post(`${AUTH}/login`).send({ email: user.email, password: 'PasLeBon123!' });

    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("maskEmail garde de quoi diagnostiquer, sans l'adresse complète", () => {
    expect(maskEmail('nathalie@exemple.fr')).toBe('n***@exemple.fr');
    expect(maskEmail('pas-un-email')).toBe('***');
  });
});
