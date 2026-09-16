// ══════════════════════════════════════════════════════════
// Statistiques publiques légères — pour l'instant, uniquement le
// nombre de participants (page d'accueil). Volontairement séparé de
// proposalsController/surveysController : ce n'est ni une liste ni
// un détail d'une ressource, juste un agrégat transverse.
// ══════════════════════════════════════════════════════════

import prisma from '../lib/prisma.js';

// ── GET /stats/participants ──────────────────────────────
//
// "Participant" = citoyen ayant réellement voté OU répondu à une
// enquête au moins une fois — pas simplement le nombre de comptes
// créés (quelqu'un d'inscrit qui n'a jamais rien fait n'est pas
// vraiment un·e "participant·e"). Deux requêtes DISTINCT plutôt
// qu'une jointure complexe : chacune reste triviale à lire, et le
// volume de données ici est trop faible pour que la différence de
// performance compte.
export async function getParticipantsCount(req, res, next) {
  try {
    const [voters, responders] = await Promise.all([
      prisma.vote.findMany({ distinct: ['userId'], select: { userId: true } }),
      prisma.surveyResponse.findMany({ distinct: ['userId'], select: { userId: true } }),
    ]);

    const uniqueParticipants = new Set([
      ...voters.map((v) => v.userId),
      ...responders.map((r) => r.userId),
    ]);

    res.json({ total: uniqueParticipants.size });
  } catch (err) {
    next(err);
  }
}
