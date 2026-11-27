// ══════════════════════════════════════════════════════════
// Barre d'enregistrement collée en bas de l'écran (recette du 13/10)
//
// « J'ai cliqué sur Clôturée : il faut que j'aille jusqu'en bas de
// l'enquête pour valider » — avec 39 questions, le bouton était à des
// mètres du champ modifié. Et l'erreur s'affichait tout EN HAUT, loin
// des yeux, au moment même où l'on cliquait tout EN BAS.
//
// La barre reste visible pendant tout le défilement (position: sticky)
// et porte, À CÔTÉ du bouton, le message d'erreur de l'enregistrement.
//
// Analogie : le bouton « Enregistrer » d'un traitement de texte est
// toujours dans la barre d'outils — personne ne va le chercher à la
// dernière page du document.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';

/**
 * À placer en DERNIER dans le <form> (le bouton est de type submit).
 * @param {object} props
 * @param {boolean} props.saving
 * @param {string} props.label - ex. « Enregistrer les modifications »
 * @param {string|null} props.error - message à afficher à côté du bouton
 * @param {string} props.cancelTo - lien « Annuler » (retour à la liste)
 */
export default function FormSaveBar({ saving, label, error, cancelTo }) {
  return (
    <div
      className="form-save-bar"
      style={{
        position: 'sticky', bottom: 0, zIndex: 20,
        background: '#FDF8F0', borderTop: '2px solid #EFEBE2',
        margin: '10px -20px 0', padding: '12px 20px',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14,
        boxShadow: '0 -6px 16px rgba(38, 51, 58, 0.08)',
      }}
    >
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? 'Enregistrement…' : label}
      </button>
      <Link to={cancelTo} style={{ color: '#6B6257', fontSize: 14 }}>Annuler</Link>
      {/* role="alert" : annoncé dès qu'il apparaît, là où l'on vient de cliquer */}
      {error && (
        <p role="alert" style={{ flex: '1 1 260px', margin: 0, color: '#A8442F', fontWeight: 600, fontSize: 15 }}>
          {error}
        </p>
      )}
    </div>
  );
}
