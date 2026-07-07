// ══════════════════════════════════════════════════════════
// Tests d'intégration — Auth (Sprint 1)
//
// "Intégration" = on ne teste pas une fonction isolée, mais
// le parcours COMPLET d'une requête HTTP : Express → validate()
// → contrôleur → Prisma → vraie base Postgres → réponse JSON.
// Supertest simule un vrai client HTTP sans ouvrir de port réseau.
//
// Le SEUL élément "faux" du système, c'est Nodemailer (mocké
// globalement dans tests/setup.js) — tout le reste est le vrai
// code de production, contre une vraie base de test.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { sendMailMock } from './setup.js';
import { buildUser, extractTokenFromEmail } from './helpers.js';

const API = '/api/v1/auth';

describe('Auth — parcours complet', () => {
  it('inscription → email de vérification "envoyé" (mocké)', async () => {
    const user = buildUser();

    const res = await request(app).post(`${API}/register`).send(user);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(user.email);
    // Le mot de passe ne doit JAMAIS apparaître dans la réponse
    expect(res.body.user.passwordHash).toBeUndefined();

    // Le vrai email n'est jamais parti sur le réseau — on vérifie
    // juste que le code A TENTÉ de l'envoyer, au bon destinataire.
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe(user.email);
  });

  it('refuse une inscription avec un email déjà utilisé', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);

    // Même email, pseudo différent pour isoler ce qu'on teste
    const res = await request(app)
      .post(`${API}/register`)
      .send({ ...user, pseudo: 'autrepseudo' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('refuse la connexion avant vérification de l\'email', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);

    const res = await request(app)
      .post(`${API}/login`)
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('parcours complet : inscription → vérification → connexion → /me', async () => {
    const user = buildUser();

    // 1. Inscription
    await request(app).post(`${API}/register`).send(user);

    // 2. On récupère le jeton depuis l'email "envoyé" (mocké) —
    //    exactement ce qu'un vrai utilisateur ferait en cliquant
    //    le lien dans sa boîte mail.
    const emailArgs = sendMailMock.mock.calls[0][0];
    const token = extractTokenFromEmail(emailArgs);

    // 3. Vérification de l'email
    const verifyRes = await request(app).post(`${API}/verify-email`).send({ token });
    expect(verifyRes.status).toBe(200);

    // 4. Connexion — devrait fonctionner maintenant
    const loginRes = await request(app)
      .post(`${API}/login`)
      .send({ email: user.email, password: user.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    // Ce compte vient d'être vérifié à l'instant (étape 3) — la
    // réponse de login doit le refléter immédiatement, sans attendre
    // un futur appel à /me. Sans ce champ, le front ne peut pas
    // savoir si un citoyen fraîchement connecté peut voter ou non.
    expect(loginRes.body.user.emailVerified).toBe(true);

    // 5. Route protégée, avec le JWT reçu à la connexion
    const meRes = await request(app)
      .get(`${API}/me`)
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(user.email);
    expect(meRes.body.user.emailVerified).toBe(true);
    // Verrouille les VRAIS noms de champs Prisma (notifyNewProposal,
    // notifySurveyClosed) — un ancien bug avait utilisé un nom inventé
    // (notificationPref) qui n'existe pas dans schema.prisma. Sans
    // cette vérification précise, le même faux nom pourrait revenir
    // dans un futur copier-coller sans qu'aucun test ne le remarque.
    expect(meRes.body.user.notifyNewProposal).toBe(true);
    expect(meRes.body.user.notifySurveyClosed).toBe(true);
  });

  it('refuse /me sans jeton', async () => {
    const res = await request(app).get(`${API}/me`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('refuse un jeton de vérification déjà utilisé (usage unique)', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);
    const token = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);

    await request(app).post(`${API}/verify-email`).send({ token });

    // Deuxième utilisation du MÊME jeton → doit échouer, comme
    // un ticket de consigne qu'on essaie de réutiliser.
    const res = await request(app).post(`${API}/verify-email`).send({ token });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('mot de passe oublié → réinitialisation → connexion avec le nouveau mot de passe', async () => {
    const user = buildUser();
    await request(app).post(`${API}/register`).send(user);

    // Il faut un compte vérifié pour pouvoir se connecter ensuite
    const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);
    await request(app).post(`${API}/verify-email`).send({ token: verifyToken });

    // On oublie l'email de vérification pour ne compter que le
    // prochain envoi (celui du reset password)
    sendMailMock.mockClear();

    await request(app).post(`${API}/forgot-password`).send({ email: user.email });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const resetToken = extractTokenFromEmail(sendMailMock.mock.calls[0][0]);
    const newPassword = 'NouveauMotDePasse456!';

    const resetRes = await request(app)
      .post(`${API}/reset-password`)
      .send({ token: resetToken, password: newPassword });
    expect(resetRes.status).toBe(200);

    // L'ancien mot de passe ne fonctionne plus
    const oldLoginRes = await request(app)
      .post(`${API}/login`)
      .send({ email: user.email, password: user.password });
    expect(oldLoginRes.status).toBe(401);

    // Le nouveau mot de passe fonctionne
    const newLoginRes = await request(app)
      .post(`${API}/login`)
      .send({ email: user.email, password: newPassword });
    expect(newLoginRes.status).toBe(200);
  });

  it('forgot-password répond pareil, que l\'email existe ou non (anti-énumération)', async () => {
    const res = await request(app)
      .post(`${API}/forgot-password`)
      .send({ email: 'personne-inscrite@senlis-test.fr' });

    expect(res.status).toBe(200);
    // Aucun email envoyé (l'utilisateur n'existe pas) mais la
    // réponse HTTP est identique au cas où il existerait — sinon
    // on révélerait quels emails sont inscrits.
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
