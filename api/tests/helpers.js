// ══════════════════════════════════════════════════════════
// Petits outils réutilisés par les tests d'intégration
// ══════════════════════════════════════════════════════════

import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { sendMailMock } from './setup.js';

let counter = 0;

/**
 * Crée une proposition directement en base (sans passer par l'API),
 * pour préparer le terrain d'un test sans dépendre du contrôleur
 * qu'on est justement en train de tester.
 */
export function seedProposal(overrides = {}) {
  return prisma.proposal.create({
    data: {
      slug: `proposition-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Piétonnisation du centre historique',
      summary: 'Fermer le centre-ville à la circulation chaque samedi.',
      content: 'Argumentaire complet avec chiffres INSEE et retours des commerçants...',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      ...overrides,
    },
  });
}

/**
 * Construit un utilisateur de test avec un email et un pseudo
 * uniques à chaque appel.
 *
 * Pourquoi c'est nécessaire : email ET pseudo sont @unique dans
 * schema.prisma. Même si beforeEach() vide la BDD entre chaque
 * test, DEUX appels à buildUser() dans le MÊME test (ex. "refuse
 * un email déjà pris") doivent rester différenciables — d'où le
 * compteur plutôt qu'une valeur fixe.
 */
export function buildUser(overrides = {}) {
  counter += 1;
  return {
    email: `test${counter}@senlis-test.fr`,
    password: 'MotDePasse123!',
    pseudo: `testeur${counter}`,
    ...overrides,
  };
}

/**
 * Extrait le jeton (VERIFY_EMAIL ou RESET_PASSWORD) depuis les
 * arguments capturés par sendMailMock.
 *
 * Le HTML de l'email contient un lien du type :
 *   http://localhost:5173/verification-email?token=abcdef123...
 * On récupère juste la valeur après "token=".
 *
 * @param {{ html: string }} sendMailCallArgs - sendMailMock.mock.calls[i][0]
 */
export function extractTokenFromEmail(sendMailCallArgs) {
  const match = sendMailCallArgs.html.match(/token=([a-f0-9]+)/);

  if (!match) {
    throw new Error(
      "Aucun jeton trouvé dans le HTML de l'email — sendMailMock a-t-il bien été appelé ?"
    );
  }

  return match[1];
}

/**
 * Fabrique un citoyen inscrit ET vérifié, prêt à voter. Contrairement
 * à makeAdminUser(), pas de promotion en base — juste le parcours
 * normal d'un visiteur qui devient citoyen.
 *
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function makeCitizen() {
  const credentials = buildUser();

  await request(app).post('/api/v1/auth/register').send(credentials);
  const token = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
  await request(app).post('/api/v1/auth/verify-email').send({ token: token });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: credentials.email, password: credentials.password });

  return { user: loginRes.body.user, token: loginRes.body.token };
}

/**
 * Fabrique un utilisateur ADMIN prêt à l'emploi et renvoie son JWT.
 *
 * Il n'existe pas (encore) de route API pour créer un admin — c'est
 * volontaire, un rôle aussi puissant ne doit pas s'auto-attribuer
 * depuis un formulaire public. En vrai, c'est ton seed.js qui joue
 * ce rôle. Ici, on suit le même chemin qu'un vrai citoyen (inscription,
 * vérification email) PUIS on promeut le compte directement en base,
 * en contournant l'API — exactement ce qu'un seed ferait.
 *
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function makeAdminUser() {
  const credentials = buildUser();

  await request(app).post('/api/v1/auth/register').send(credentials);

  const verifyToken = extractTokenFromEmail(sendMailMock.mock.calls.at(-1)[0]);
  await request(app).post('/api/v1/auth/verify-email').send({ token: verifyToken });

  await prisma.user.update({
    where: { email: credentials.email },
    data: { role: 'ADMIN' },
  });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: credentials.email, password: credentials.password });

  return { user: loginRes.body.user, token: loginRes.body.token };
}
