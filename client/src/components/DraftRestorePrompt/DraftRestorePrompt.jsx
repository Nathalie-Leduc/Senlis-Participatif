// ══════════════════════════════════════════════════════════
// « Reprendre ou repartir de zéro ? » (S5R2-13)
//
// Affiché À LA PLACE du formulaire d'administration quand une saisie
// non enregistrée a été retrouvée. Le choix est obligatoire : si le
// formulaire restait affiché à côté, la moindre frappe écraserait le
// brouillon retrouvé sans que personne l'ait décidé.
//
// Analogie : le traitement de texte qui, après une coupure, demande
// « Récupérer le document ? » AVANT de rouvrir la page.
// ══════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { formatDraftDate } from '../../utils/draftStorage.js';

/**
 * @param {object} props
 * @param {string} props.savedAt - date ISO de la dernière sauvegarde
 * @param {string} props.what - ex. « cette enquête », « cette proposition »
 * @param {() => void} props.onRestore
 * @param {() => void} props.onDiscard
 * @param {string} [props.note] - précision, ex. « L'image n'est pas gardée »
 */
export default function DraftRestorePrompt({ savedAt, what, onRestore, onDiscard, note }) {
  // Focus sur le titre : un lecteur d'écran annonce tout de suite
  // pourquoi le formulaire attendu n'est pas là (RGAA 7.1)
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <section
      aria-labelledby="draft-restore-title"
      style={{ background: '#FFF4D6', border: '2px solid #C99A2E', borderRadius: 16, padding: 20 }}
    >
      <h2
        id="draft-restore-title" ref={headingRef} tabIndex={-1}
        style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: '0 0 8px' }}
      >
        Une saisie non enregistrée a été retrouvée
      </h2>
      <p style={{ margin: '0 0 6px' }}>
        Vous aviez commencé à remplir {what} le <strong>{formatDraftDate(savedAt)}</strong>, sans l'enregistrer.
      </p>
      {note && <p style={{ margin: '0 0 6px', fontSize: 14, color: '#6B6257' }}>{note}</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" onClick={onRestore} className="btn btn-primary">
          Reprendre ma saisie
        </button>
        <button type="button" onClick={onDiscard} className="btn" style={{ background: '#EFEBE2', color: '#26333A' }}>
          Repartir de zéro
        </button>
      </div>
    </section>
  );
}
