// ══════════════════════════════════════════════════════════
// Tests — la fiche publique d'un compte (S5R2-08 partie 3)
//
// OWASP A01 (exposition de données) : ce que le navigateur reçoit d'un
// compte passe par UNE liste blanche (toPublicUser). On vérifie qu'elle
// est la même partout et qu'aucun champ interne ne s'y glisse.
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { makeCitizen, makeAdminUser } from './helpers.js';

const EXPECTED_KEYS = [
  'id', 'email', 'pseudo', 'role', 'emailVerified',
  'situation', 'quartier', 'travailleQuartier', 'travailType', 'travailleASenlis',
  'notifyNewProposal', 'notifySurveyClosed', 'createdAt', 'passwordRenewalDue',
].sort();

// Ce qui ne doit JAMAIS quitter le serveur
const FORBIDDEN = ['passwordHash', 'tokenVersion', 'passwordChangedAt', 'lastLoginAt', 'inactivityWarnedAt', 'inactivityFinalWarnedAt'];

describe('Fiche publique du compte (liste blanche)', () => {
  it('connexion et /auth/me renvoient exactement les mêmes champs, sans champ interne', async () => {
    const { user: atLogin, token } = await makeCitizen();
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(Object.keys(atLogin).sort()).toEqual(EXPECTED_KEYS);
    expect(Object.keys(me.body.user).sort()).toEqual(EXPECTED_KEYS);
    for (const field of FORBIDDEN) {
      expect(atLogin).not.toHaveProperty(field);
      expect(me.body.user).not.toHaveProperty(field);
    }
  });

  it('après la double authentification (compte de l\'équipe), même fiche', async () => {
    const { user } = await makeAdminUser();
    expect(Object.keys(user).sort()).toEqual(EXPECTED_KEYS);
    expect(user).not.toHaveProperty('passwordHash');
  });
});

describe('Adresse d\'API inconnue (OWASP A02)', () => {
  it('répond 404 en JSON, pas la page HTML d\'Express', async () => {
    const res = await request(app).get('/api/v1/nexiste-pas');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.text).not.toMatch(/Cannot GET/);
  });
});
