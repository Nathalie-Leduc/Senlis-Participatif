// ══════════════════════════════════════════════════════════
// Bandeau « Mode Admin-test » (S5R2-11)
//
// Rappelle à un compte Admin-test (EDITOR) ce qu'il peut faire :
// préparer et tester des brouillons. Les boutons qu'il ne peut pas
// utiliser sont masqués ailleurs ; ce bandeau explique POURQUOI ils
// manquent, plutôt que de laisser croire à un oubli.
//
// Analogie : l'étiquette « Apprenti » sur la veste en cuisine — tout
// le monde sait ce que la personne peut faire, elle la première.
//
// Ne rend rien pour un admin ou un citoyen : on peut donc le placer
// sans condition en haut de chaque page de gestion.
// ══════════════════════════════════════════════════════════

import { useAuth } from '../../contexts/AuthContext.jsx';

export default function EditorBanner() {
  const { isEditor } = useAuth();
  if (!isEditor) return null;
  return (
    <p role="note" style={{
      background: '#E3F0F6', border: '2px solid #1E5F7C', borderRadius: 12,
      padding: '10px 14px', fontSize: 15, margin: '0 0 20px', color: '#26333A',
    }}>
      <span aria-hidden="true">🧑‍🍳 </span>
      <strong>Mode Admin-test</strong> : vous pouvez préparer et tester des brouillons ;
      la publication est faite par l'administration.
    </p>
  );
}
