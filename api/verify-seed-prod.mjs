// Vérifie la cohérence des showIf dans questionsSpec de seed-prod.js
// SANS toucher à la base de données — à lancer après toute
// modification manuelle du fichier, avant de relancer npm run seed:prod.
//
// Usage : node verify-seed-prod.mjs
// (à placer dans api/ et lancer depuis ce dossier)

import { readFileSync } from 'fs';

const src = readFileSync('./prisma/seed-prod.js', 'utf8');
const startConst = src.indexOf('const PARKING_OPTIONS');
const endSpec = src.indexOf('\n  ];\n\n  // $transaction');

if (startConst === -1 || endSpec === -1) {
  console.log('❌ Impossible de repérer questionsSpec dans le fichier — a-t-il beaucoup changé de structure ?');
  process.exit(1);
}

const block = src.slice(startConst, endSpec + 6);
const fn = new Function(`${block}\nreturn questionsSpec;`);
const questionsSpec = fn();

// Même règle par défaut que la vraie création (OUI_NON sans options
// explicites → "Oui"/"Non")
const withDefaults = questionsSpec.map((q) => ({
  ...q,
  options: q.options ?? (q.type === 'OUI_NON' ? [{ label: 'Oui' }, { label: 'Non' }] : undefined),
}));

let ok = true;
withDefaults.forEach((q, index) => {
  const optCount = q.options ? q.options.length : 0;
  if ((q.type === 'CHOIX_UNIQUE' || q.type === 'CHOIX_MULTIPLE') && optCount < 2) {
    console.log(`❌ [${index}] type ${q.type} avec seulement ${optCount} option(s) — "${q.label.slice(0, 50)}"`);
    ok = false;
  }
  if (q.showIf) {
    const target = withDefaults[q.showIf.questionOrder];
    if (!target) {
      console.log(`❌ [${index}] questionOrder ${q.showIf.questionOrder} inexistant — "${q.label.slice(0, 50)}"`);
      ok = false;
    } else if (q.showIf.questionOrder >= index) {
      console.log(`❌ [${index}] dépend d'une question NON antérieure — "${q.label.slice(0, 50)}"`);
      ok = false;
    } else if (!target.options || !target.options[q.showIf.optionOrder]) {
      console.log(`❌ [${index}] optionOrder ${q.showIf.optionOrder} inexistant sur Q${q.showIf.questionOrder} (${target.options?.length || 0} options) — "${q.label.slice(0, 50)}"`);
      ok = false;
    } else {
      console.log(`✓ [${index}] "${q.label.slice(0, 40)}" → showIf Q${q.showIf.questionOrder} option "${target.options[q.showIf.optionOrder].label}"`);
    }
  }
});

console.log(`\nTotal questions : ${withDefaults.length}`);
console.log(ok ? '\n✅ Toutes les références sont valides — sans danger de relancer le seed' : '\n❌ DES RÉFÉRENCES SONT CASSÉES — ne relance pas le seed avant correction');
