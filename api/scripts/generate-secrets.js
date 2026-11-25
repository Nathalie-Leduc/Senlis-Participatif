// ══════════════════════════════════════════════════════════
// Générateur de secrets pour la mise en ligne (S5-22)
//
//   npm run secrets --prefix api
//
// Affiche des valeurs NEUVES, tirées au hasard par le générateur
// cryptographique de Node (crypto.randomBytes), à recopier dans les
// variables d'environnement de Clever Cloud. Rien n'est écrit sur le
// disque, rien n'est envoyé nulle part : les valeurs n'existent que
// dans votre terminal. Fermez-le une fois les valeurs recopiées.
//
// Pourquoi régénérer ? Les secrets de développement ont circulé
// (fichiers .env, captures, conversations) : ils sont « grillés ».
// Analogie : en emménageant, on change les serrures, même si l'ancien
// locataire jure n'avoir gardé aucun double.
// ══════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto';
import { passwordProblem } from '../src/lib/passwordPolicy.js';

// JWT_SECRET : 32 octets aléatoires = 256 bits, écrits en 64 caractères
// hexadécimaux. validateEnv refuse moins de 32 caractères en production.
const jwtSecret = randomBytes(32).toString('hex');

// Mot de passe du compte administrateur (seed de production) :
// 24 caractères aléatoires (lettres, chiffres, « - » et « _ »), soit
// environ 144 bits. Vérifié par la même politique que le site (CNIL +
// NIST : 15 caractères au moins, pas de mot de passe courant…).
// À ranger dans un gestionnaire de mots de passe (Bitwarden, KeePass…).
function adminPassword() {
  for (;;) {
    const candidate = randomBytes(18).toString('base64url'); // 24 caractères
    if (!passwordProblem(candidate, {})) return candidate;
  }
}

console.log(`
Secrets NEUFS pour la production — à recopier dans Clever Cloud
(application de l'API → Environment variables), puis fermer ce terminal.

  JWT_SECRET=${jwtSecret}
  ADMIN_PASSWORD=${adminPassword()}

À régénérer AUSSI, dans leur propre console (jamais ici) :
  • SMTP_PASS          → Brevo : SMTP & API → créer une nouvelle clé SMTP,
                         puis supprimer l'ancienne
  • AZURE_SPEECH_KEY   → portail Azure : ressource Speech → « Clés et point
                         de terminaison » → régénérer la clé 1 (ou la 2)

Rappels :
  • Changer JWT_SECRET déconnecte tout le monde : c'est voulu.
  • ADMIN_PASSWORD ne sert qu'au premier « seed » de production :
    retirez-le des variables de Clever Cloud juste après.
`);
