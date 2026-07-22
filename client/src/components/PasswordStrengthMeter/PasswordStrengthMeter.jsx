// ══════════════════════════════════════════════════════════
// Jauge de robustesse du mot de passe — recommandations CNIL
//
// Les 5 critères correspondent EXACTEMENT à la règle Zod côté API
// (validators/auth.js) : les dupliquer ici n'est pas idéal en
// théorie, mais un vrai partage de code entre client et API
// demanderait un package commun — hors de portée pour ce projet.
// Ce qui compte : les deux doivent rester synchronisés si la règle
// change un jour.
//
// Analogie : une jauge de carburant qui se remplit de rouge à vert
// au fur et à mesure que le mot de passe remplit les critères —
// sans jamais dire au conducteur "vous n'irez nulle part" (aucun
// blocage ici, juste une indication ; le formulaire refuse la
// soumission via minLength/pattern natifs, pas via ce composant).
// ══════════════════════════════════════════════════════════

const CRITERIA = [
  { test: (p) => p.length >= 12, label: 'Au moins 12 caractères' },
  { test: (p) => /[a-z]/.test(p), label: 'Une minuscule' },
  { test: (p) => /[A-Z]/.test(p), label: 'Une majuscule' },
  { test: (p) => /\d/.test(p), label: 'Un chiffre' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'Un caractère spécial' },
];

// Index = nombre de critères validés (0 à 5). Le rouge et le vert
// aux deux extrémités sont ceux qu'on veut voir en premier coup
// d'œil ; les teintes intermédiaires n'ont pas besoin d'être
// précises, juste de graduer visiblement entre les deux.
const LEVELS = [
  { color: '#A8442F', label: 'Trop faible' },
  { color: '#A8442F', label: 'Trop faible' },
  { color: '#C97A2E', label: 'Faible' },
  { color: '#D4A72C', label: 'Moyen' },
  { color: '#8AA84A', label: 'Bon' },
  { color: '#3A7A4D', label: 'Excellent' },
];

/**
 * @param {{ password: string }} props
 */
export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const passedCount = CRITERIA.filter((c) => c.test(password)).length;
  const level = LEVELS[passedCount];
  // 8% de "socle" visible même à 0 critère rempli — une barre
  // totalement vide se confond avec l'absence de composant.
  const percentage = 8 + (passedCount / CRITERIA.length) * 92;
  const missing = CRITERIA.filter((c) => !c.test(password));

  return (
    <div style={{ marginTop: 8 }} aria-live="polite">
      <div style={{ height: 6, borderRadius: 999, background: '#EFEBE2', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%', borderRadius: 999, background: level.color,
            width: `${percentage}%`, transition: 'width .2s ease, background-color .2s ease',
          }}
        />
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, color: level.color, margin: '4px 0 0' }}>
        {level.label}
      </p>
      {missing.length > 0 && (
        <ul style={{ fontSize: 12, color: '#6B6257', margin: '4px 0 0', paddingLeft: 18 }}>
          {missing.map((c) => <li key={c.label}>{c.label}</li>)}
        </ul>
      )}
    </div>
  );
}
