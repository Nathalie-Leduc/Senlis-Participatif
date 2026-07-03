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

// ── 2. Nettoyage de la BDD avant chaque test ────────────
//
// deleteMany() sans "where" = vide toute la table.
// Ordre important, à cause des clés étrangères :
// Vote et Comment référencent Proposal (et User) → on les
// efface en premier. Comment n'est pas encore utilisé par nos
// tests (Lot 2), mais la table existe déjà (migration initiale)
// — autant la nettoyer maintenant plutôt que de retomber dans
// le même piège que pour Proposal le jour où on l'utilisera.
beforeEach(async () => {
  await prisma.vote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.user.deleteMany();

  // On oublie aussi les appels enregistrés par le test précédent,
  // sinon "toHaveBeenCalledTimes(1)" compterait les emails de
  // TOUS les tests depuis le début du fichier.
  sendMailMock.mockClear();
});
