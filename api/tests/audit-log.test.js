// ══════════════════════════════════════════════════════════
// Tests d'intégration — Journal des actions d'administration (S5A-06)
// ══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { makeAdminUser, makeCitizen, seedProposal, seedUser } from './helpers.js';
import { purgeOldAuditLogs } from '../src/services/retention.js';

async function logsFor(action) {
  return prisma.adminAuditLog.findMany({ where: { action }, orderBy: { createdAt: 'asc' } });
}

describe("Journal d'administration", () => {
  it('une connexion admin (après le code 2FA) est journalisée', async () => {
    const { user } = await makeAdminUser();
    const [entry] = await logsFor('ADMIN_LOGIN');
    expect(entry).toMatchObject({ actorId: user.id, actorPseudo: user.pseudo });
  });

  it("une connexion citoyenne ne l'est pas (le journal ne trace que les administrateurs)", async () => {
    await makeCitizen();
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });

  it('un changement de rôle est journalisé avec son avant/après', async () => {
    const admin = await makeAdminUser();
    const { user: citizen } = await makeCitizen();

    await request(app)
      .patch(`/api/v1/admin/users/${citizen.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'ADMIN' });

    const [entry] = await logsFor('USER_ROLE_CHANGED');
    expect(entry).toMatchObject({
      actorId: admin.user.id, targetType: 'User', targetId: citizen.id,
      details: { from: 'CITIZEN', to: 'ADMIN' },
    });
  });

  it('créer, modifier puis supprimer une proposition laisse trois traces, titre compris', async () => {
    const { token } = await makeAdminUser();

    const created = await request(app).post('/api/v1/proposals').set('Authorization', `Bearer ${token}`).send({
      title: 'Piétonniser la rue de Paris', summary: 'Un résumé suffisamment long pour Zod', content: 'Un contenu suffisamment long pour passer la validation du schéma.',
    });
    expect(created.status).toBe(201);
    const id = created.body.proposal.id;

    await request(app).patch(`/api/v1/proposals/${id}`).set('Authorization', `Bearer ${token}`).send({ status: 'PUBLISHED' });
    await request(app).delete(`/api/v1/proposals/${id}`).set('Authorization', `Bearer ${token}`);

    const actions = (await prisma.adminAuditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: 'asc' } }))
      .map((e) => e.action);
    expect(actions).toEqual(['PROPOSAL_CREATED', 'PROPOSAL_UPDATED', 'PROPOSAL_DELETED']);

    const [updated] = await logsFor('PROPOSAL_UPDATED');
    expect(updated.details).toMatchObject({ fields: ['status'], status: { from: 'DRAFT', to: 'PUBLISHED' } });

    const [deleted] = await logsFor('PROPOSAL_DELETED');
    expect(deleted.details.title).toBe('Piétonniser la rue de Paris');
  });

  it('une action REFUSÉE (citoyen non-admin) ne laisse aucune trace', async () => {
    const proposal = await seedProposal();
    const { token } = await makeCitizen();
    await request(app).delete(`/api/v1/proposals/${proposal.id}`).set('Authorization', `Bearer ${token}`);
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });

  it("le journal survit à la suppression du compte de l'admin (pseudo conservé)", async () => {
    const { user } = await makeAdminUser();
    await prisma.user.delete({ where: { id: user.id } });

    const [entry] = await logsFor('ADMIN_LOGIN');
    expect(entry.actorId).toBeNull();
    expect(entry.actorPseudo).toBe(user.pseudo);
  });

  it('la purge efface les lignes de plus de 6 mois, garde les récentes', async () => {
    const admin = await seedUser({ role: 'ADMIN' });
    const now = new Date('2030-06-15T03:00:00Z');
    await prisma.adminAuditLog.createMany({
      data: [
        { action: 'ADMIN_LOGIN', actorId: admin.id, actorPseudo: admin.pseudo, createdAt: new Date('2029-12-01T00:00:00Z') },
        { action: 'ADMIN_LOGIN', actorId: admin.id, actorPseudo: admin.pseudo, createdAt: new Date('2030-01-01T00:00:00Z') },
      ],
    });

    expect(await purgeOldAuditLogs({ now })).toBe(1);
    const left = await prisma.adminAuditLog.findMany();
    expect(left).toHaveLength(1);
    expect(left[0].createdAt).toEqual(new Date('2030-01-01T00:00:00Z'));
  });
});
