// ══════════════════════════════════════════════════════════
// Middleware d'upload d'image — Multer
//
// Multer récupère le fichier envoyé en multipart/form-data et le
// garde EN MÉMOIRE (memoryStorage), jamais directement écrit sur
// disque tel quel : on veut d'abord le recompresser et le convertir
// en WebP avec Sharp (voir lib/imageProcessing.js) avant de
// l'enregistrer pour de bon — même principe que le pipeline Sharp
// déjà utilisé sur Cinés Délices.
//
// Analogie : c'est le vestiaire à l'entrée d'un restaurant — le
// manteau (fichier brut envoyé par le navigateur) n'est jamais posé
// n'importe où ; il passe d'abord par un point de contrôle avant
// d'être rangé au bon endroit sous sa forme définitive.
// ══════════════════════════════════════════════════════════

import multer from 'multer';

// 5 Mo — large pour une photo de smartphone, mais pas illimité.
// Dépassement → MulterError LIMIT_FILE_SIZE → 413 (errorHandler.js)
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    // On passe une erreur EXPLICITE à Multer plutôt que de laisser
    // passer un fichier qu'on refuserait de traiter plus loin. Elle
    // porte son statut et son code : sans eux, errorHandler.js n'a
    // aucun moyen de savoir que c'est la faute du fichier, et répond
    // 500 (bug corrigé en S5A-02).
    const error = new Error('Format d\'image non supporté (JPEG, PNG ou WebP uniquement)');
    error.status = 400;
    error.code = 'INVALID_FILE_TYPE';
    return cb(error);
  }
  cb(null, true);
}

// .single('image') : le champ du <form>/FormData envoyé par le client
// DOIT s'appeler "image" — c'est le nom qu'on utilisera aussi côté
// client dans api.js (fd.append('image', file)).
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter,
}).single('image');
