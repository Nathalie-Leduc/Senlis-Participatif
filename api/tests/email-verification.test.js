// ══════════════════════════════════════════════════════════
// Tests d'intégration — Vérification d'email fiable (S5R-01)
//
// Bug de recette du 30/09/2026 : le lien de vérification envoyé deux
// fois (double clic, ou mode StrictMode de React en développement)
// affichait « Jeton invalide ou déjà utilisé » alors que l'adresse
// venait BIEN d'être vérifiée. Et aucun moyen de recevoir un nouveau
// lien : un compte non vérifié restait bloqué pour toujours.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { sendMailMock } from './setup.js';
import { buildUser, extractTokenFromEmail } from './helpers.js';

const AUTH = '/api/v1/auth';

/** Inscrit un compte et renvoie ses identifiants + le jeton reçu par email. */
async function registerAndGetToken() {
  const credentials = buildUser();
  await request(app).post(`${AUTH}/register`).send(credentials);
  const token = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
  return { credentials, token };
}

describe('POST /auth/verify-email — idempotent', () => {
  it('un second clic sur le même lien répond « déjà vérifiée », pas une erreur', async () => {
    const { token } = await registerAndGetToken();

    const first = await request(app).post(`${AUTH}/verify-email`).send({ token });
    expect(first.status).toBe(200);

    const second = await request(app).post(`${AUTH}/verify-email`).send({ token });
    expect(second.status).toBe(200);
    expect(second.body.alreadyVerified).toBe(true);
  });

  it('deux envois SIMULTANÉS (le cas StrictMode) : deux succès, compte vérifié', async () => {
    const { credentials, token } = await registerAndGetToken();

    const [a, b] = await Promise.all([
      request(app).post(`${AUTH}/verify-email`).send({ token }),
      request(app).post(`${AUTH}/verify-email`).send({ token }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);
    const user = await prisma.user.findUnique({ where: { email: credentials.email } });
    expect(user.emailVerified).toBe(true);
  });

  it("un lien REMPLACÉ par un plus récent, sur un compte encore non vérifié, reste refusé", async () => {
    const { credentials, token: oldToken } = await registerAndGetToken();
    // Nouveau lien demandé : l'ancien est invalidé
    await request(app).post(`${AUTH}/resend-verification`).send({ email: credentials.email });

    const res = await request(app).post(`${AUTH}/verify-email`).send({ token: oldToken });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('un jeton inconnu reste une erreur', async () => {
    const res = await request(app).post(`${AUTH}/verify-email`).send({ token: 'a'.repeat(64) });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/resend-verification', () => {
  it('envoie un NOUVEAU lien, qui fonctionne, à un compte non vérifié', async () => {
    const { credentials } = await registerAndGetToken();
    sendMailMock.mockClear();

    const res = await request(app).post(`${AUTH}/resend-verification`).send({ email: credentials.email });
    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const newToken = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);
    const verify = await request(app).post(`${AUTH}/verify-email`).send({ token: newToken });
    expect(verify.status).toBe(200);
    expect(verify.body.alreadyVerified).toBeUndefined();
  });

  it("répond EXACTEMENT pareil pour une adresse inconnue, un compte vérifié ou non (anti-énumération) — sans rien envoyer aux deux premiers", async () => {
    const { credentials, token } = await registerAndGetToken();
    const pending = await request(app).post(`${AUTH}/resend-verification`).send({ email: credentials.email });

    await request(app).post(`${AUTH}/verify-email`).send({ token: extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]) });
    sendMailMock.mockClear();
    const verified = await request(app).post(`${AUTH}/resend-verification`).send({ email: credentials.email });
    const unknown = await request(app).post(`${AUTH}/resend-verification`).send({ email: 'personne@exemple.fr' });

    expect(verified.body).toEqual(pending.body);
    expect(unknown.body).toEqual(pending.body);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(token).toBeDefined();
  });

  it('400 pour une adresse mal formée', async () => {
    const res = await request(app).post(`${AUTH}/resend-verification`).send({ email: 'pas-une-adresse' });
    expect(res.status).toBe(400);
  });
});
