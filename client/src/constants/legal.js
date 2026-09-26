// ══════════════════════════════════════════════════════════
// Informations légales — SOURCE UNIQUE (S5A-04)
//
// Les mentions légales et la politique de confidentialité lisent
// toutes leurs données ici. Pourquoi un fichier à part ?
//  1. Un changement (d'hébergeur, d'adresse de contact, de durée de
//     conservation) se fait à UN endroit, et les deux pages restent
//     cohérentes entre elles.
//  2. Les tests (LegalPages.test.jsx) vérifient ce fichier contre le
//     CODE réel : chaque donnée stockée dans le navigateur par
//     l'application doit être déclarée ici — on ne décrit que ce
//     qu'on fait, et on n'oublie rien de ce qu'on fait.
//
// Analogie : l'étiquette de composition d'un produit alimentaire.
// Elle doit être exacte ET complète — un ingrédient ajouté à la
// recette sans être ajouté à l'étiquette, c'est une faute.
//
// ⚠️ Toute évolution qui ajoute une donnée personnelle (un champ du
// profil, un nouveau service tiers, une nouvelle clé localStorage)
// doit mettre ce fichier à jour — c'est dans la Definition of Done.
// ══════════════════════════════════════════════════════════

/** Date de dernière mise à jour des deux pages (à changer à chaque modification de fond). */
export const LAST_UPDATED = '25 septembre 2026';

export const SITE = {
  name: 'Senlis Participatif',
  url: 'https://senlis-participatif.fr',
};

/**
 * Adresse de contact pour les demandes RGPD et les signalements.
 * ⚠️ À créer chez OVH (redirection email gratuite du domaine) vers
 * ta boîte personnelle AVANT la mise en ligne.
 */
export const CONTACT_EMAIL = 'contact@senlis-participatif.fr';

/**
 * Éditeur du site.
 *
 * name: null → mode « éditeur non professionnel » prévu par la LCEN
 * (loi n° 2004-575 du 21 juin 2004) : une personne physique qui édite
 * un site à titre non professionnel peut ne publier que les
 * coordonnées de son hébergeur, À CONDITION d'avoir communiqué son
 * identité complète à celui-ci (c'est le cas : le compte Clever Cloud
 * est à ton nom).
 *
 * Pour afficher ton nom à la place, remplace null par
 * 'Prénom Nom' — la page bascule automatiquement.
 * Le jour où la mairie reprend le site, c'est elle qui devient
 * éditrice : ce bloc sera à réécrire entièrement (Lot 3).
 */
export const EDITOR = {
  name: null,
  status: 'Personne physique, à titre non professionnel',
};

/** Hébergeur (mention obligatoire — LCEN). Vérifié le 25/09/2026 sur clever.cloud/fr/mentions-legales. */
export const HOST = {
  name: 'Clever Cloud SAS',
  address: '4 rue Voltaire, 44000 Nantes, France',
  phone: '02 85 52 07 69',
  registration: 'RCS Nantes 524 172 699',
  dataLocation: 'Données hébergées en France',
};

/**
 * Destinataires des données : qui, en dehors de l'éditeur, voit passer
 * quoi (RGPD art. 13.1.e). Ordre : sous-traitants d'abord, services
 * appelés directement par le navigateur ensuite.
 */
export const RECIPIENTS = [
  {
    name: 'Clever Cloud SAS (Nantes, France)',
    role: 'Hébergement du site, de l’API et de la base de données (sous-traitant)',
    data: 'Toutes les données du service, stockées en France',
  },
  {
    name: 'Brevo — Sendinblue SAS (Paris, France)',
    role: 'Envoi des emails du service (sous-traitant)',
    data: 'Votre adresse email et le contenu du message (lien de vérification, code de connexion…)',
  },
  {
    name: 'Fondation OpenStreetMap (Royaume-Uni)',
    role: 'Fonds de carte affichés par votre navigateur',
    data: 'Votre adresse IP et les zones de carte consultées — le Royaume-Uni bénéficie d’une décision d’adéquation de la Commission européenne',
  },
  {
    name: 'API Découpage administratif — geo.api.gouv.fr (DINUM, État français)',
    role: 'Suggestions de communes pendant la saisie de certaines réponses d’enquête',
    data: 'Votre adresse IP et les lettres tapées dans le champ « ville »',
  },
];

/**
 * Données stockées DANS VOTRE NAVIGATEUR (localStorage /
 * sessionStorage). Aucune n'exige de consentement : toutes sont
 * strictement nécessaires au service ou choisies par l'utilisateur
 * (exemptions de l'art. 82 de la loi Informatique et Libertés,
 * délibération CNIL n° 2020-091).
 *
 * `key` doit correspondre EXACTEMENT à la clé utilisée dans le code :
 * le test LegalPages.test.jsx le vérifie dans les deux sens.
 */
export const BROWSER_STORAGE = [
  {
    key: 'token',
    storage: 'localStorage',
    purpose: 'Vous garder connecté·e (jeton de session)',
    duration: '7 heures, ou jusqu’à la déconnexion',
  },
  {
    key: 'trustedDeviceToken',
    storage: 'localStorage',
    purpose: 'Comptes administrateurs : éviter de redemander le code de connexion sur ce navigateur',
    duration: '1 heure',
  },
  {
    key: 'senlis-a11y-settings',
    storage: 'localStorage',
    purpose: 'Mémoriser vos réglages d’accessibilité (taille du texte, contraste…)',
    duration: 'Jusqu’à ce que vous les réinitialisiez',
  },
  {
    key: 'senlis:pendingVote',
    storage: 'sessionStorage',
    purpose: 'Retenir un vote cliqué avant la connexion, pour l’enregistrer juste après',
    duration: 'Jusqu’à la fermeture de l’onglet',
  },
];

/**
 * Durées de conservation (RGPD art. 13.2.a).
 * ⚠️ La purge automatique des comptes inactifs et des jetons expirés
 * est implémentée par S5A-05 — la politique ne doit pas être publiée
 * (mise en ligne S5-22) avant que cette issue soit livrée.
 */
export const RETENTION = [
  { data: 'Compte et profil déclaré', duration: 'Jusqu’à la suppression du compte, ou 3 ans sans connexion (après un email d’avertissement)' },
  { data: 'Votes', duration: 'Supprimés avec le compte' },
  { data: 'Réponses aux enquêtes', duration: 'Détachées du compte à sa suppression, puis conservées de façon anonyme pour ne pas fausser les résultats' },
  { data: 'Liens reçus par email (vérification, mot de passe)', duration: '1 heure, à usage unique' },
  { data: 'Code de connexion administrateur', duration: '10 minutes, à usage unique' },
  { data: 'Journaux techniques du serveur (adresse IP, page demandée)', duration: '1 an au plus, pour la sécurité du service' },
];

export const CNIL = {
  complaintUrl: 'https://www.cnil.fr/fr/plaintes',
};
