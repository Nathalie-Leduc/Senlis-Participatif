// ══════════════════════════════════════════════════════════
// Tests d'intégration — Robustesse des erreurs (S5A-02)
//
// Une API honnête dit POURQUOI elle refuse. Avant S5A-02, plusieurs
// refus parfaitement prévisibles remontaient en « 500 — erreur
// inattendue » : le client ne pouvait rien afficher d'utile, et un
// 500 sonne comme un bug du serveur alors que c'est la demande qui
// n'allait pas.
//
// Analogie : un guichet qui répond « problème technique » à la fois
// quand l'imprimante est en panne ET quand il te manque une pièce
// d'identité. Seul le premier cas est vraiment un problème technique.
//
// Couvert ici :
//  - violation d'unicité Prisma (P2002) → 409 avec un code précis ;
//  - enregistrement introuvable (P2025) → 404 ;
//  - erreurs d'upload Multer → 400 / 413 ;
//  - JSON mal formé ou trop gros → 400 / 413 ;
//  - le profil travail saisi à l'inscription est bien enregistré.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { buildUser, makeCitizen, makeAdminUser, seedProposal } from './helpers.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
// Import explicite : la config ESLint des tests ne déclare pas les
// globales Node (Buffer), seulement celles de Vitest.
import { Buffer } from 'node:buffer';

const AUTH = '/api/v1/auth';

describe('Inscription — profil enregistré tel que saisi', () => {
  it('enregistre le quartier ET le rôle de travail envoyés par le formulaire', async () => {
    const credentials = buildUser({
      situation: 'HORS_SENLIS',
      travailleQuartier: 'CENTRE_HISTORIQUE',
      travailType: 'COMMERCANT',
    });

    const res = await request(app).post(`${AUTH}/register`).send(credentials);
    expect(res.status).toBe(201);

    const inDb = await prisma.user.findUnique({ where: { email: credentials.email } });
    expect(inDb.travailleQuartier).toBe('CENTRE_HISTORIQUE');
    expect(inDb.travailType).toBe('COMMERCANT');
  });

  it("n'enregistre pas de rôle de travail sans quartier de travail (donnée sans objet)", async () => {
    const credentials = buildUser({ travailType: 'SALARIE' });

    await request(app).post(`${AUTH}/register`).send(credentials);

    const inDb = await prisma.user.findUnique({ where: { email: credentials.email } });
    expect(inDb.travailleQuartier).toBeNull();
    expect(inDb.travailType).toBeNull();
  });

  it("n'enregistre un quartier de résidence que pour « autre quartier de Senlis »", async () => {
    const centre = buildUser({ situation: 'CENTRE_RESIDENT', quartier: 'BRICHEBAY' });
    const autre = buildUser({ situation: 'AUTRE_QUARTIER', quartier: 'BRICHEBAY' });

    await request(app).post(`${AUTH}/register`).send(centre);
    await request(app).post(`${AUTH}/register`).send(autre);

    const [centreDb, autreDb] = await Promise.all([
      prisma.user.findUnique({ where: { email: centre.email } }),
      prisma.user.findUnique({ where: { email: autre.email } }),
    ]);
    expect(centreDb.quartier).toBeNull();
    expect(autreDb.quartier).toBe('BRICHEBAY');
  });
});

describe('Unicité (P2002) → 409 avec un code précis', () => {
  it('409 PSEUDO_TAKEN à l\'inscription avec un pseudo déjà pris', async () => {
    const first = buildUser();
    await request(app).post(`${AUTH}/register`).send(first);

    const res = await request(app)
      .post(`${AUTH}/register`)
      .send(buildUser({ pseudo: first.pseudo }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PSEUDO_TAKEN');
  });

  it('409 PSEUDO_TAKEN en prenant, dans « Mon compte », le pseudo de quelqu\'un d\'autre', async () => {
    const other = await makeCitizen();
    const { token } = await makeCitizen();

    const res = await request(app)
      .patch(`${AUTH}/me`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pseudo: other.user.pseudo });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PSEUDO_TAKEN');
  });

  it('deux inscriptions SIMULTANÉES avec le même email : une 201, une 409 EMAIL_TAKEN (jamais de 500)', async () => {
    const credentials = buildUser();
    // Même email, pseudos différents : seule la contrainte sur l'email
    // peut départager — et les deux requêtes peuvent passer ensemble
    // la vérification « email déjà pris ? » avant que l'une écrive.
    const [a, b] = await Promise.all([
      request(app).post(`${AUTH}/register`).send(credentials),
      request(app).post(`${AUTH}/register`).send({ ...credentials, pseudo: `${credentials.pseudo}bis` }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const refused = a.status === 409 ? a : b;
    expect(refused.body.error.code).toBe('EMAIL_TAKEN');
    expect(await prisma.user.count({ where: { email: credentials.email } })).toBe(1);
  });
});

describe('Upload d\'image (Multer) → 400 / 413', () => {
  it('413 FILE_TOO_LARGE au-delà de 5 Mo', async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();
    const sixMegabytes = Buffer.alloc(6 * 1024 * 1024, 0);

    const res = await request(app)
      .post(`/api/v1/proposals/${proposal.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', sixMegabytes, { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('400 INVALID_FILE_TYPE pour un format non accepté (PDF)', async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();

    const res = await request(app)
      .post(`/api/v1/proposals/${proposal.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('400 UPLOAD_ERROR si le fichier arrive sous un autre nom de champ que « image »', async () => {
    const proposal = await seedProposal();
    const { token } = await makeAdminUser();

    const res = await request(app)
      .post(`/api/v1/proposals/${proposal.id}/image`)
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('x'), { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UPLOAD_ERROR');
  });
});

describe('Corps de requête → 400 / 413', () => {
  it('400 INVALID_JSON pour un JSON mal formé', async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.fr", ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('413 PAYLOAD_TOO_LARGE au-delà de 10 ko de JSON', async () => {
    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'a@b.fr', password: 'x'.repeat(20 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('errorHandler — traduction des erreurs Prisma (test unitaire)', () => {
  // Faux objet `res` Express : on capture le statut et le JSON.
  function fakeRes() {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
  }

  it('P2025 (enregistrement introuvable) → 404 NOT_FOUND', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('No record was found'), { code: 'P2025' }), {}, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('P2002 au format classique de Prisma (meta.target) → 409 EMAIL_TAKEN', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('Unique'), { code: 'P2002', meta: { target: ['email'] } }), {}, res, () => {});
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  // Cas réel constaté en S5A-02 : sur un PostgreSQL configuré en
  // français, l'adaptateur pg ne sait plus extraire les champs du
  // message (traduit) et n'envoie pas `constraint`. Seul le nom de
  // l'index, cité dans le message, permet encore de savoir lequel.
  it('P2002 depuis un PostgreSQL en FRANÇAIS (sans champs extraits) → 409 PSEUDO_TAKEN grâce au nom de l\'index', () => {
    const res = fakeRes();
    const err = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: {
        modelName: 'User',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '23505',
            originalMessage: 'la valeur d\'une clé dupliquée rompt la contrainte unique « User_pseudo_key »',
            kind: 'UniqueConstraintViolation',
          },
        },
      },
    });
    errorHandler(err, {}, res, () => {});
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('PSEUDO_TAKEN');
  });

  it('P2002 depuis un PostgreSQL en ANGLAIS (champs extraits par l\'adaptateur) → 409 EMAIL_TAKEN', () => {
    const res = fakeRes();
    const err = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: {
        driverAdapterError: {
          cause: {
            originalMessage: 'duplicate key value violates unique constraint "User_email_key"',
            constraint: { fields: ['email'] },
          },
        },
      },
    });
    errorHandler(err, {}, res, () => {});
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('P2002 sur une autre contrainte → 409 CONFLICT générique, sans détail technique', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('Unique constraint failed on (slug)'), { code: 'P2002', meta: { target: ['slug'] } }), {}, res, () => {});
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).not.toMatch(/constraint/i);
  });
});
