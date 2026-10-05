// ══════════════════════════════════════════════════════════
// Contenu du guide « Cerf-tifié utile ! » (S5R-04)
//
// Séparé du composant : c'est du TEXTE, que l'on corrigera plus
// souvent que le code — et il doit rester EXACT. La maquette disait
// « Personne ne peut relier vos réponses à vous » : c'est faux (tant
// que le compte existe, la base sait qui a répondu quoi). La réponse
// ci-dessous dit ce que le site garantit vraiment.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';

/**
 * Astuce de bienvenue, selon la page. Testées dans l'ordre : la
 * première correspondance gagne (les routes les plus précises d'abord).
 */
export const PAGE_TIPS = [
  { match: (path) => path === '/', text: 'Commencez par voter sur une proposition, ou répondez à une enquête en cours !' },
  { match: (path) => path.startsWith('/propositions/'), text: 'Lisez l’argumentaire, regardez la carte, puis votez : Pour, Contre ou Neutre.' },
  { match: (path) => path.startsWith('/propositions'), text: 'Choisissez une proposition pour la découvrir en détail et donner votre avis.' },
  { match: (path) => path.startsWith('/enquetes'), text: 'Une question par écran, quelques minutes suffisent. Votre avis compte !' },
  { match: (path) => path.startsWith('/inscription'), text: 'Après l’inscription, pensez à cliquer sur le lien reçu par email.' },
  { match: (path) => path.startsWith('/mon-compte'), text: 'Ici, vous modifiez votre profil, téléchargez vos données ou supprimez votre compte.' },
  { match: (path) => path.startsWith('/admin'), text: 'Un brouillon reste privé tant que vous ne le publiez pas.' },
];
export const DEFAULT_TIP = 'Une question ? Choisissez-la ci-dessous.';

/** Questions fréquentes : la question (bouton) et la réponse du cerf. */
export const FAQ = [
  {
    id: 'voter',
    question: 'Comment voter ?',
    answer: (
      <>
        🗳️ Ouvrez une proposition et cliquez sur <strong>Pour</strong>, <strong>Contre</strong> ou{' '}
        <strong>Neutre</strong>. Un seul vote par personne, mais vous pouvez changer d'avis tant que le vote
        est ouvert. Il faut un compte avec une adresse email confirmée.
      </>
    ),
  },
  {
    id: 'donnees',
    question: 'Mes données ?',
    answer: (
      <>
        🔒 Votre vote et vos réponses ne sont <strong>jamais publiés individuellement</strong> : seuls des
        totaux sont affichés, et un groupe de moins de 5 personnes n'est jamais détaillé. Vous pouvez
        télécharger ou effacer vos données à tout moment. <Link to="/confidentialite">En savoir plus</Link>
      </>
    ),
  },
  {
    id: 'pourquoi',
    question: 'Pourquoi participer ?',
    answer: (
      <>
        📊 Plus nous sommes nombreux, plus les résultats pèsent auprès de la mairie. À Senlis, la
        démocratie, c'est ensemble ! 💪
      </>
    ),
  },
];
