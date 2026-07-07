// ══════════════════════════════════════════════════════════
// VoteButtons — les 3 boutons POUR / NEUTRE / CONTRE
//
// Purement "présentationnel" : ce composant ne parle JAMAIS à
// l'API lui-même. Il reçoit l'état actuel (quel vote est actif,
// si le vote est désactivé) et prévient son parent quand on
// clique — c'est PropositionDetail qui décide quoi faire de ce
// clic (appeler l'API, rediriger vers la connexion, etc.).
//
// Analogie : ce composant est le clavier du téléphone, pas le
// standard téléphonique (services/api.js). Il transmet "quelle
// touche a été pressée" ; il ne compose jamais le numéro lui-même.
//
// Accessibilité :
// - aria-pressed indique l'état actif/inactif à un lecteur
//   d'écran — un bouton à BASCULE, pas une simple action
// - min-height 48px : cible tactile confortable au doigt
//   (09-charte-graphique.md)
// - role="group" + aria-label : les 3 boutons sont annoncés
//   comme un ensemble cohérent, pas 3 boutons isolés
// ══════════════════════════════════════════════════════════

const OPTIONS = [
  { value: 'POUR', label: 'Pour', icon: '✓', color: '#3A7A4D', bg: '#E0F2E5' },
  { value: 'NEUTRE', label: 'Neutre', icon: '◯', color: '#6B6257', bg: '#EFEBE2' },
  { value: 'CONTRE', label: 'Contre', icon: '✗', color: '#A8442F', bg: '#FCEAE6' },
];

export default function VoteButtons({ myVote, disabled, onSelect }) {
  return (
    <div role="group" aria-label="Voter sur cette proposition" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {OPTIONS.map((opt) => {
        const active = myVote === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            style={{
              flex: '1 1 140px',
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontWeight: 700,
              fontSize: 16,
              borderRadius: 14,
              border: `2px solid ${active ? opt.color : '#e3dcce'}`,
              background: active ? opt.bg : '#fff',
              color: active ? opt.color : '#26333A',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <span aria-hidden="true">{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
