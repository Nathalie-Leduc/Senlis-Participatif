// ══════════════════════════════════════════════════════════
// Service API — unique point de contact avec le back
//
// Aucun composant React ne fait de fetch direct.
// Tout passe par ce fichier. Le jour où l'API change
// (v2, gestion d'erreurs, en-têtes), un seul fichier bouge.
//
// Analogie : c'est le standard téléphonique du restaurant.
// Tous les appels passent par là, qu'ils viennent de la
// salle (pages), du bar (composants) ou de la cuisine (hooks).
// ══════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Appel générique à l'API.
 * Ajoute automatiquement le JWT si disponible.
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  });

  // Les erreurs API arrivent en JSON normalisé
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { message: 'Erreur réseau inattendue' },
    }));
    throw { status: response.status, ...error.error };
  }

  // 204 No Content (ex : suppression réussie)
  if (response.status === 204) return null;

  return response.json();
}

// ── Upload de fichier (multipart/form-data) ──────────────
//
// Pourquoi une fonction à part plutôt que réutiliser apiFetch() ?
// apiFetch fixe toujours 'Content-Type': 'application/json' — juste
// pour du texte, ça convient à tous les autres appels. Mais un
// FormData a besoin d'un Content-Type "multipart/form-data;
// boundary=..." calculé par le NAVIGATEUR lui-même (le boundary est
// un identifiant aléatoire propre à chaque requête). Le fixer à la
// main casserait l'upload — le boundary ne correspondrait plus à
// rien dans le corps de la requête.
async function apiUpload(path, formData) {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      // Pas de Content-Type ici : voir le commentaire ci-dessus.
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { message: 'Erreur réseau inattendue' },
    }));
    throw { status: response.status, ...error.error };
  }

  return response.json();
}

// ── Raccourcis ──────────────────────────────────────────
export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
  // file : un objet File (ex. depuis <input type="file">)
  uploadProposalImage: (proposalId, file) => {
    const formData = new FormData();
    // 'image' doit correspondre EXACTEMENT au nom attendu par
    // uploadImage.single('image') côté API (middlewares/upload.js).
    formData.append('image', file);
    return apiUpload(`/proposals/${proposalId}/image`, formData);
  },
};
