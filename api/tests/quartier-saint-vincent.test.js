// ══════════════════════════════════════════════════════════
// Tests — le centre en deux quartiers (S5R2-06)
//
// « Quartier Saint-Vincent » (SAINT_VINCENT) doit être accepté partout
// où l'on choisit un quartier : profil (résidence et travail), zone
// d'une proposition, public visé et synchronisation d'une enquête.
// Et un profil « centre historique » existant ne doit pas bouger.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeCitizen, seedUser } from './helpers.js';
import { matchesAudience } from '../src/lib/audience.js';
import { QUARTIERS, QUARTIERS_RESIDENCE } from '../src/lib/quartiers.js';

const as = (token) => ({ Authorization: `Bearer ${token}` });

describe('Liste commune des quartiers', () => {
  it('8 quartiers ; Saint-Vincent est un « autre quartier », pas le Centre historique', () => {
    expect(QUARTIERS).toHaveLength(8);
    expect(QUARTIERS_RESIDENCE).toContain('SAINT_VINCENT');
    expect(QUARTIERS_RESIDENCE).not.toContain('CENTRE_HISTORIQUE');
  });
});

describe('Profil', () => {
  it('on peut déclarer habiter et travailler à Saint-Vincent', async () => {
    const { token } = await makeCitizen();
    const res = await request(app).patch('/api/v1/auth/me').set(as(token)).send({
      situation: 'AUTRE_QUARTIER', quartier: 'SAINT_VINCENT',
      travailleASenlis: true, travailleQuartier: 'SAINT_VINCENT', travailType: 'COMMERCANT',
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ quartier: 'SAINT_VINCENT', travailleQuartier: 'SAINT_VINCENT' });
  });

  it('un profil « centre historique » existant n’est pas touché', async () => {
    const user = await seedUser({ situation: 'CENTRE_RESIDENT', travailleQuartier: 'CENTRE_HISTORIQUE' });
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after).toMatchObject({ situation: 'CENTRE_RESIDENT', travailleQuartier: 'CENTRE_HISTORIQUE' });
  });
});

describe('Proposition et enquête', () => {
  it('une proposition peut concerner Saint-Vincent', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app).post('/api/v1/proposals').set(as(token)).send({
      title: 'Ralentir rue Saint-Vincent', summary: 'Une zone 30 devant l’école.',
      content: 'Argumentaire : les voitures roulent vite devant l’école.', zoneQuartiers: ['SAINT_VINCENT'],
    });
    expect(res.status).toBe(201);
    expect(res.body.proposal.zoneQuartiers).toEqual(['SAINT_VINCENT']);
  });

  it('une enquête peut viser les habitants de Saint-Vincent, et synchroniser ce quartier', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app).post('/api/v1/surveys').set(as(token)).send({
      title: 'Saint-Vincent demain', description: 'Une description suffisamment longue',
      audience: { situations: ['AUTRE_QUARTIER'], quartiers: ['SAINT_VINCENT'], workQuartiers: ['SAINT_VINCENT'] },
      questions: [{
        label: 'Dans quel quartier ?', type: 'CHOIX_UNIQUE', syncsToProfile: 'quartier',
        options: [{ label: 'Saint-Vincent', syncValue: 'SAINT_VINCENT' }, { label: 'Brichebay', syncValue: 'BRICHEBAY' }],
      }],
    });
    expect(res.status).toBe(201);

    const audience = { situations: ['AUTRE_QUARTIER'], quartiers: ['SAINT_VINCENT'], workQuartiers: [], workTypes: [] };
    expect(matchesAudience(audience, { situation: 'AUTRE_QUARTIER', quartier: 'SAINT_VINCENT' })).toBe(true);
    // Le Centre historique n'est PAS Saint-Vincent
    expect(matchesAudience(audience, { situation: 'CENTRE_RESIDENT' })).toBe(false);
  });

  it('un quartier inconnu reste refusé', async () => {
    const { token } = await makeCitizen();
    const res = await request(app).patch('/api/v1/auth/me').set(as(token)).send({ situation: 'AUTRE_QUARTIER', quartier: 'CENTRE_EST' });
    expect(res.status).toBe(400);
  });
});
