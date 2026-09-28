// ══════════════════════════════════════════════════════════
// Message d'erreur de formulaire, RELIÉ aux champs (S5A-07 — RGAA 11.10)
//
// Avant : une erreur s'affichait en rouge au-dessus du formulaire.
// Un voyant la voit ; un utilisateur de lecteur d'écran, lui, restait
// sur le champ sans savoir que quelque chose n'allait pas, ni quoi.
//
// Maintenant, deux liens invisibles :
//  1. role="alert" : le message est LU à voix haute dès qu'il apparaît ;
//  2. aria-describedby sur le champ (via errorProps) : quand on revient
//     sur le champ, le lecteur d'écran relit l'erreur avec son libellé,
//     et aria-invalid annonce « saisie invalide ».
//
// Analogie : au lieu d'un panneau « erreur quelque part » affiché à
// l'entrée du bâtiment, une étiquette accrochée directement sur la
// porte concernée.
//
// Usage :
//   <input {...errorProps(Boolean(error), 'connexion-error')} … />
//   <FormError id="connexion-error">{error}</FormError>
// ══════════════════════════════════════════════════════════

/**
 * Attributs ARIA à poser sur un champ concerné par une erreur.
 * @param {boolean} hasError
 * @param {string} errorId - id du <FormError> correspondant
 */
export function errorProps(hasError, errorId) {
  return hasError
    ? { 'aria-invalid': true, 'aria-describedby': errorId }
    : {};
}

/**
 * @param {{ id: string, children?: React.ReactNode, style?: object }} props
 */
export default function FormError({ id, children, style }) {
  // Rien à afficher : on ne rend RIEN (pas une boîte vide), sinon le
  // lecteur d'écran annoncerait une alerte muette.
  if (!children) return null;
  return (
    <div
      id={id}
      role="alert"
      style={{
        background: '#FCEAE6', color: '#A8442F', padding: '12px 16px',
        borderRadius: 12, marginBottom: 16, fontSize: 15, ...style,
      }}
    >
      {children}
    </div>
  );
}
