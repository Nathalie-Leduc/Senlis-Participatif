// ══════════════════════════════════════════════════════════
// Faire télécharger un objet JavaScript sous forme de fichier JSON
// (S5A-05 — export « Mes données »).
//
// Pourquoi ne pas simplement ouvrir /api/v1/auth/me/export dans un
// nouvel onglet ? Parce que cette route exige le jeton de connexion
// dans l'en-tête Authorization, qu'un simple lien ne sait pas
// envoyer. On récupère donc les données via services/api.js (qui
// ajoute le jeton), puis on fabrique le fichier DANS le navigateur.
//
// Analogie : au lieu d'envoyer quelqu'un chercher le colis au
// guichet (il n'a pas la procuration), on le récupère soi-même et
// on le lui remet emballé.
// ══════════════════════════════════════════════════════════

/**
 * @param {unknown} data - l'objet à enregistrer
 * @param {string} filename - ex. 'mes-donnees.json'
 */
export function downloadJson(data, filename) {
  // JSON indenté : le fichier doit aussi être lisible par un humain
  const blob = new window.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  // Une URL temporaire qui pointe vers le fichier en mémoire
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename; // « enregistrer sous » plutôt qu'« ouvrir »
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Libère la mémoire : sans ça, le fichier resterait en mémoire
  // jusqu'à la fermeture de l'onglet.
  URL.revokeObjectURL(url);
}

/** Nom de fichier daté : senlis-participatif-mes-donnees-AAAA-MM-JJ.json */
export function exportFilename(date = new Date()) {
  return `senlis-participatif-mes-donnees-${date.toISOString().slice(0, 10)}.json`;
}
