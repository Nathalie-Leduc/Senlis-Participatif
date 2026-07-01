// ══════════════════════════════════════════════════════════
// Slug — transforme un titre en identifiant lisible d'URL
//
// "Piétonnisation du centre historique !" → "pietonnisation-du-centre-historique"
//
// Pourquoi un slug plutôt que l'UUID dans l'URL ? Deux raisons :
// - SEO : Google comprend "pietonnisation-du-centre-historique",
//   pas "a1b2c3d4-e5f6-..."
// - Partage humain : c'est ce lien-là qu'on envoie à la mairie
//   ou qu'on imprime sur un flyer avec un QR code.
//
// Analogie : l'UUID, c'est le numéro de dossier administratif.
// Le slug, c'est le nom du dossier écrit à la main sur la
// chemise cartonnée — plus personne ne retient le numéro.
// ══════════════════════════════════════════════════════════

/**
 * Nettoie un texte libre en slug : minuscules, sans accents,
 * espaces et ponctuation remplacés par des tirets.
 */
export function slugify(text) {
  return text
    .normalize('NFD')                  // sépare lettre et accent (é → e + ´)
    .replace(/[\u0300-\u036f]/g, '')   // supprime les accents détachés
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')       // tout ce qui n'est pas alphanumérique → tiret
    .replace(/^-+|-+$/g, '');          // pas de tiret en début/fin
}

/**
 * Génère un slug unique pour un modèle Prisma donné (ex. Proposal).
 * Si "pietonnisation-du-centre" existe déjà, essaie
 * "pietonnisation-du-centre-2", puis "-3", etc.
 *
 * @param {string} title - Le titre à transformer
 * @param {{ findUnique: Function }} model - Un délégué Prisma (ex. prisma.proposal)
 * @returns {Promise<string>} Un slug garanti disponible
 */
export async function generateUniqueSlug(title, model) {
  const base = slugify(title);
  let slug = base;
  let counter = 2;

  // Boucle volontairement simple : en pratique, deux propositions
  // avec EXACTEMENT le même titre sont rarissimes — pas besoin
  // d'optimiser une requête groupée pour ce cas.
  while (await model.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}
