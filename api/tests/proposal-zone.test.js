// ══════════════════════════════════════════════════════════
// Tests — zone concernée par une proposition (S5R-10)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { makeAdminUser } from './helpers.js';

const API = '/api/v1/proposals';
const base = {
  title: 'Piétonniser la rue de Paris', summary: 'Un résumé suffisamment long', content: 'Un argumentaire suffisamment long pour Zod.',
};

describe('Zone d’une proposition', () => {
  it('enregistre des quartiers IRIS et les renvoie, dans le détail comme dans la liste', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app).post(API).set('Authorization', `Bearer ${token}`)
      .send({ ...base, status: 'PUBLISHED', zoneQuartiers: ['CENTRE_HISTORIQUE', 'BRICHEBAY'] });
    expect(res.status).toBe(201);
    expect(res.body.proposal).toMatchObject({ zoneWholeCity: false, zoneQuartiers: ['CENTRE_HISTORIQUE', 'BRICHEBAY'] });

    const list = await request(app).get(API);
    expect(list.body.items[0].zoneQuartiers).toEqual(['CENTRE_HISTORIQUE', 'BRICHEBAY']);
  });

  it('« toute la ville »', async () => {
    const { token } = await makeAdminUser();
    const res = await request(app).post(API).set('Authorization', `Bearer ${token}`).send({ ...base, zoneWholeCity: true });
    expect(res.body.proposal).toMatchObject({ zoneWholeCity: true, zoneQuartiers: [] });
  });

  it("refuse « toute la ville » ET des quartiers, ou un quartier inconnu", async () => {
    const { token } = await makeAdminUser();
    for (const zone of [{ zoneWholeCity: true, zoneQuartiers: ['BRICHEBAY'] }, { zoneQuartiers: ['MARS'] }]) {
      const res = await request(app).post(API).set('Authorization', `Bearer ${token}`).send({ ...base, ...zone });
      expect(res.status).toBe(400);
    }
  });

  it('les réglages avancés (point, tracé) peuvent enfin être EFFACÉS', async () => {
    const { token } = await makeAdminUser();
    const created = await request(app).post(API).set('Authorization', `Bearer ${token}`).send({
      ...base, lat: 49.2, lng: 2.58, geoJson: { type: 'Point', coordinates: [2.58, 49.2] },
    });
    const id = created.body.proposal.id;

    const res = await request(app).patch(`${API}/${id}`).set('Authorization', `Bearer ${token}`)
      .send({ lat: null, lng: null, geoJson: null, zoneQuartiers: ['VILLEVERT'] });
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ lat: null, lng: null, geoJson: null, zoneQuartiers: ['VILLEVERT'] });
  });
});
