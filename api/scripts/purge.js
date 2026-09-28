// ══════════════════════════════════════════════════════════
// Purge quotidienne des données (S5A-05)
//
// Usage :
//   npm run purge              → applique la purge
//   npm run purge -- --dry-run → COMPTE seulement, ne supprime et
//                                n'envoie rien (à lancer d'abord en
//                                production pour vérifier)
//
// En production : lancé une fois par jour par une tâche planifiée
// Clever Cloud (mise en place en S5-22). Toute la logique vit dans
// src/services/retention.js, testée par tests/retention.test.js —
// ce fichier ne fait que l'appeler et afficher le bilan.
// ══════════════════════════════════════════════════════════

import { runRetention } from '../src/services/retention.js';
import prisma from '../src/lib/prisma.js';

const dryRun = process.argv.includes('--dry-run');

try {
  const report = await runRetention({ dryRun });
  const verb = dryRun ? 'à traiter (simulation)' : 'traités';
  console.log(`🧹 Purge ${verb} — ${new Date().toISOString()}`);
  console.log(`   Comptes inactifs supprimés     : ${report.deletedAccounts}`);
  console.log(`   Avertissements envoyés         : ${report.warnedAccounts}`);
  console.log(`   Avertissements en échec (SMTP) : ${report.failedWarnings}`);
  console.log(`   Jetons expirés supprimés       : ${report.deletedTokens}`);
  // Un échec d'envoi n'est pas fatal (retenté demain), mais on le
  // signale par le code de sortie : la tâche planifiée apparaîtra en
  // erreur dans la console Clever Cloud, et on ira voir pourquoi.
  process.exitCode = report.failedWarnings > 0 ? 1 : 0;
} catch (err) {
  console.error('❌ Purge interrompue :', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
