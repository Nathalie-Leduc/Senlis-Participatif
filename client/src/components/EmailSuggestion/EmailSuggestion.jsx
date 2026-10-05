// ══════════════════════════════════════════════════════════
// « Vouliez-vous dire nath@gmail.com ? » (S5R-02)
//
// Proposé sous un champ email quand le domaine ressemble de très près
// à un fournisseur courant (voir suggestEmail). Jamais bloquant : on
// peut l'ignorer — « ville-senlis.fr » n'est pas une faute de frappe.
// Un clic sur l'adresse proposée remplace la saisie.
// ══════════════════════════════════════════════════════════

import { suggestEmail } from '../../utils/formValidation.js';

/**
 * @param {{ email: string, onAccept: (corrected: string) => void, hidden?: boolean }} props
 *   hidden : à true quand le champ affiche déjà une erreur (un seul message à la fois)
 */
export default function EmailSuggestion({ email, onAccept, hidden = false }) {
  const suggestion = hidden ? null : suggestEmail(email);
  // aria-live : la suggestion est lue quand elle apparaît, sans
  // interrompre la saisie (conteneur toujours présent, voir FieldError)
  return (
    <div aria-live="polite">
      {suggestion && (
        <p style={{ fontSize: 14, margin: '6px 0 0', color: '#26333A' }}>
          Vouliez-vous dire{' '}
          <button
            type="button" onClick={() => onAccept(suggestion)}
            style={{ background: 'none', border: 'none', padding: 0, color: '#1E5F7C', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 14 }}
          >
            {suggestion}
          </button>{' '}?
        </p>
      )}
    </div>
  );
}
