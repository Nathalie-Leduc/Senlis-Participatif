// ══════════════════════════════════════════════════════════
// Zod 4, réglé pour le projet (S5R2-08 partie 2)
//
// Tous les validateurs importent `z` d'ICI, plus de 'zod' directement :
// le réglage ci-dessous s'applique donc partout, même aux tests qui
// importent un seul validateur.
//
// Pourquoi ? Zod 4 répond en ANGLAIS par défaut (« Invalid input:
// expected string, received undefined »). Ces messages arrivent tels
// quels sous les champs du formulaire, côté citoyen.
//
// Deux étages, du plus précis au plus général :
//   1. le message écrit dans le schéma (ex. 'Le nom est obligatoire')
//      — toujours prioritaire ;
//   2. sinon, nos règles communes : un champ ABSENT → « Ce champ est
//      obligatoire », une date illisible → « Date invalide » (plus
//      clairs que la traduction officielle) ;
//   3. sinon, la traduction française officielle de Zod (z.locales.fr).
//
// Analogie : le standard de la mairie. Si le service concerné a laissé
// une consigne précise, on la lit ; sinon une réponse type ; sinon le
// répondeur général — mais toujours en français.
// ══════════════════════════════════════════════════════════

import { z } from 'zod';

z.config(z.locales.fr());
z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type' && issue.input === undefined) {
      return 'Ce champ est obligatoire';
    }
    // Une date illisible (« 31/02 », « demain »…) : la traduction
    // officielle dirait « date attendu, Date reçu », peu parlant
    if (issue.code === 'invalid_type' && issue.expected === 'date') {
      return 'Date invalide';
    }
    return undefined; // undefined = « je passe la main » à la traduction officielle
  },
});

// Message à afficher seulement quand le champ est ABSENT (remplace le
// `required_error` de Zod 3, qui n'existe plus) ; une valeur du mauvais
// type garde le message général.
export const requiredMessage = (message) => (issue) =>
  (issue.input === undefined ? message : undefined);

// Message à afficher quand la valeur n'est pas du bon type (remplace
// `invalid_type_error` de Zod 3, qui n'existe plus)
export const typeMessage = (message) => (issue) =>
  (issue.code === 'invalid_type' ? message : undefined);

export { z };
