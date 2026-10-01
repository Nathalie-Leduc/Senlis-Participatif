// ══════════════════════════════════════════════════════════
// Setup global des tests — s'exécute avant chaque fichier
// de test (déclaré dans vitest.config.js → setupFiles)
//
// Deux missions ici :
//
// 1. Remplacer Nodemailer par un faux transporteur. On ne
//    veut JAMAIS qu'un `npm test` envoie un vrai email à
//    Mailtrap — ni qu'il échoue parce que les identifiants
//    SMTP ne sont pas configurés en CI.
//
// 2. Vider la base de données avant chaque test, pour que
//    les tests ne se marchent pas dessus (ex. un test
//    précédent qui laisserait un email déjà pris en BDD).
//
// Analogie : avant chaque expérience scientifique, on nettoie
// la paillasse. Sinon les résidus de l'expérience précédente
// faussent le résultat de la suivante.
// ══════════════════════════════════════════════════════════

import { vi, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma.js';
import { clearEmailDomainCache } from '../src/lib/emailDomain.js';

// ── 1. Mock de Nodemailer ───────────────────────────────
//
// vi.mock() intercepte tous les `import nodemailer from 'nodemailer'`
// rencontrés pendant ce fichier de test — y compris à l'intérieur
// de services/email.js, qu'on ne modifie pas du tout. Le code de
// production ne sait même pas qu'il parle à un faux.
//
// sendMailMock est un espion (vi.fn()) : il enregistre chaque
// appel — avec quels arguments — sans rien envoyer réellement.
// On l'exporte pour pouvoir vérifier, DANS les tests, qu'un
// email a bien été "envoyé" et en extraire le jeton.
export const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'fake-id-123' });

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: sendMailMock,
    }),
  },
}));

// ── 1 bis. Mock du DNS (S5R-02b) ────────────────────────
//
// La vérification du domaine des emails (lib/emailDomain.js) interroge
// le DNS — donc Internet. Des tests qui dépendent du réseau échouent
// hors ligne, en CI, ou quand un domaine change : on remplace le
// résolveur par un faux, piloté par les tests.
//
// Par défaut, TOUT domaine « a un serveur de messagerie » : les tests
// qui ne parlent pas de DNS ne voient aucune différence. Un test qui
// veut simuler un domaine inexistant ou une panne réécrit le
// comportement de dnsMock (voir email-domain.test.js) ; il est remis
// à zéro avant chaque test.
//
// vi.hoisted : vi.mock() est REMONTÉ tout en haut du fichier, avant
// même les imports ; un objet déclaré normalement n'existerait pas
// encore au moment où le faux résolveur est construit (« Cannot access
// 'dnsMock' before initialization »). vi.hoisted le crée assez tôt.
const dnsMock = vi.hoisted(() => ({
  resolveMx: vi.fn(),
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));
// Export séparé : Vitest interdit « export const » sur une variable hoistée
export { dnsMock };

function resetDnsMock() {
  dnsMock.resolveMx.mockReset().mockResolvedValue([{ exchange: 'mx.exemple.fr', priority: 10 }]);
  dnsMock.resolve4.mockReset().mockResolvedValue(['192.0.2.1']);
  dnsMock.resolve6.mockReset().mockResolvedValue([]);
}
resetDnsMock();

vi.mock('node:dns/promises', () => ({
  // Une « classe » dont chaque instance partage les mêmes fonctions
  // espionnes : peu importe combien de résolveurs le code crée
  Resolver: class {
    constructor() {
      Object.assign(this, dnsMock);
    }
  },
}));

// ── 2. Nettoyage de la BDD avant chaque test ────────────
//
// deleteMany() sans "where" = vide toute la table.
// Ordre important, à cause des clés étrangères :
// Vote et Comment référencent Proposal (et User) → on les
// efface en premier. Comment n'est pas encore utilisé par nos
// tests (Lot 2), mais la table existe déjà (migration initiale)
// — autant la nettoyer maintenant plutôt que de retomber dans
// le même piège que pour Proposal le jour où on l'utilisera.
// Answer/SurveyResponse et QuestionOption/Question suivent le
// même principe pour les enquêtes (Sprint 4) : les tables filles
// avant les tables mères.
beforeEach(async () => {
  // Answer/SurveyResponse AVANT Survey (et avant User, même si
  // userId est SetNull côté schéma — autant nettoyer explicitement
  // plutôt que de compter sur ce détail).
  await prisma.answer.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.proposal.deleteMany();
  // QuestionOption puis Question AVANT Survey — mêmes contraintes
  // de clé étrangère que pour les propositions ci-dessus.
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.authToken.deleteMany();
  // Journal d'administration (S5A-06) : avant User par propreté,
  // même si la clé étrangère est en SetNull.
  await prisma.adminAuditLog.deleteMany();
  await prisma.user.deleteMany();

  // On oublie aussi les appels enregistrés par le test précédent,
  // sinon "toHaveBeenCalledTimes(1)" compterait les emails de
  // TOUS les tests depuis le début du fichier.
  sendMailMock.mockClear();
  resetDnsMock();
  // Le cache des domaines (10 min) survivrait sinon d'un test à l'autre
  clearEmailDomainCache();
});
