// ══════════════════════════════════════════════════════════
// Traitement des images de propositions — Sharp
//
// Pourquoi retraiter l'image plutôt que stocker le fichier envoyé
// tel quel ? Un smartphone récent produit des photos de plusieurs
// Mo, souvent bien plus larges que ce qu'une carte ou une page
// détail afficheront jamais. Sans retraitement, chaque visiteur
// téléchargerait une image 5x trop lourde pour rien.
//
// Analogie : c'est comme reformater une photo de vacances avant
// de l'envoyer par SMS — le smartphone la redimensionne pour
// qu'elle passe bien plus vite, sans perte visible à l'écran.
// ══════════════════════════════════════════════════════════

import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

// process.cwd() = dossier depuis lequel `node` a été lancé (la racine
// de api/, si on suit les scripts npm existants) — pas le dossier de
// CE fichier, qui bougerait si on réorganisait src/ plus tard.
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'proposals');
const MAX_WIDTH = 1200; // aucune mise en page du site n'affiche une image plus large

/**
 * Redimensionne et convertit un buffer image en WebP, puis
 * l'écrit sur disque. Retourne le chemin RELATIF à stocker en base.
 */
export async function saveProposalImage(buffer) {
  // recursive: true = ne plante pas si le dossier existe déjà
  // (équivalent de "mkdir -p")
  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await sharp(buffer)
    // withoutEnlargement : une image DÉJÀ plus petite que 1200px de
    // large n'est jamais agrandie (l'agrandir la rendrait juste floue
    // sans le moindre bénéfice).
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(filepath);

  return `/uploads/proposals/${filename}`;
}

/**
 * Supprime le fichier correspondant à un imagePath stocké en base.
 * Utilisée quand une image est remplacée, ou quand la proposition
 * qui la possède est supprimée.
 */
export async function deleteProposalImage(imagePath) {
  if (!imagePath) return;

  const filename = path.basename(imagePath);
  const filepath = path.join(UPLOAD_DIR, filename);

  try {
    await unlink(filepath);
  } catch {
    // Le fichier n'existe déjà plus (déjà supprimé, ou jamais écrit) —
    // pas grave : l'objectif ("qu'il n'existe plus") est déjà atteint.
    // On ne fait surtout PAS remonter cette erreur à l'appelant.
  }
}
