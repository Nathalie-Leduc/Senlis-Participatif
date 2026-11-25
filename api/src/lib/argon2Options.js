// ══════════════════════════════════════════════════════════
// Réglages d'Argon2 (S5R2-08, recette du 25/11 : tests de l'API lents)
//
// Argon2 est VOLONTAIREMENT lent et gourmand en mémoire (64 Mio,
// 3 passes par défaut) : c'est ce qui rend une base de mots de passe
// volée quasi impossible à « casser » par essais massifs.
//
// Mais les tests créent des centaines de comptes : ~170 ms par
// inscription + connexion, soit l'essentiel des 3 minutes de la suite.
//
// Règle : réglage LÉGER uniquement quand NODE_ENV === 'test' (Vitest le
// définit seul). Partout ailleurs — développement, production —, objet
// vide = les paramètres par défaut d'argon2 (argon2id, 64 Mio, t=3),
// au-dessus du minimum recommandé par l'OWASP.
//
// La vérification (argon2.verify) n'a pas besoin de réglage : les
// paramètres sont écrits DANS l'empreinte ($argon2id$v=19$m=…,t=…,p=…).
//
// Analogie : à l'entraînement, les pompiers utilisent un feu de
// démonstration ; le jour J, le vrai camion. On ne confond jamais les deux.
// ══════════════════════════════════════════════════════════

export function argon2Options(env = process.env.NODE_ENV) {
  return env === 'test'
    ? { memoryCost: 1024, timeCost: 1, parallelism: 1 } // ~2 ms
    : {}; // défauts d'argon2 : la protection complète
}
