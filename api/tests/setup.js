import { vi, beforeEach } from 'vitest';
import prisma from '../src/lib/prisma.js';

// vi.mock() intercepte TOUS les `import nodemailer from 'nodemailer'`
// rencontrés dans ce fichier de test — y compris à l'intérieur de
// services/email.js, qu'on ne touche pas du tout. Le code de prod
// ne sait même pas qu'il parle à un faux.
//
// sendMailMock est un espion (vi.fn()) : il enregistre chaque appel
// (avec quels arguments) sans rien envoyer réellement. On l'exporte
// pour vérifier, dans les tests, qu'un email a bien été "envoyé"
// et pour en extraire le jeton.
export const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'fake-id-123' });

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: sendMailMock }),
  },
}));

// Nettoyage de la BDD avant CHAQUE test — comme une paillasse
// qu'on nettoie avant chaque expérience, sinon les résidus de
// la précédente faussent le résultat de la suivante.
beforeEach(async () => {
  await prisma.authToken.deleteMany();
  await prisma.user.deleteMany();
  sendMailMock.mockClear();
});