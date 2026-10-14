// ══════════════════════════════════════════════════════════
// Lien « ← Retour » des pages d'une proposition ou d'une enquête
// (recette du 13/10)
//
// Où revenir ? Dans cet ordre :
//  1. la page d'où l'on vient, si elle l'a indiqué en ouvrant la
//     fiche (<Link state={{ from, fromLabel }}>) — c'est ce que font
//     les listes de l'administration (« Voir ») ;
//  2. sinon, pour l'équipe (admin, Admin-test), la liste de
//     l'administration : c'est d'elle qu'on part le plus souvent ;
//  3. sinon, la liste publique (citoyens, visiteurs).
//
// Pourquoi pas simplement navigate(-1) (le bouton « précédent » du
// navigateur) ? Parce qu'en arrivant par un lien partagé (un e-mail,
// Facebook…), il n'y a pas de page précédente sur le site : le bouton
// ferait sortir du site. Un lien vers une adresse connue marche toujours.
//
// Analogie : le panneau « Sortie » d'un musée. On ne vous ramène pas
// « là où vous étiez avant » (on ne le sait pas toujours), mais vers
// une salle connue.
// ══════════════════════════════════════════════════════════

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

/**
 * @param {object} props
 * @param {{ to: string, label: string }} props.publicList - la liste publique
 * @param {{ to: string, label: string }} props.staffList - la liste de l'administration
 */
export default function BackLink({ publicList, staffList }) {
  const { state } = useLocation();
  const { isStaff } = useAuth();

  const target = state?.from
    ? { to: state.from, label: state.fromLabel || 'Retour' }
    : (isStaff ? staffList : publicList);

  return (
    <Link to={target.to} style={{ display: 'block', width: 'fit-content', color: '#6B6257', fontSize: 14, marginBottom: 16 }}>
      ← {target.label}
    </Link>
  );
}
