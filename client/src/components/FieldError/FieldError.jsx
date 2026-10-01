// ══════════════════════════════════════════════════════════
// Message d'erreur SOUS un champ (S5R-02)
//
// Recette : « les messages d'erreur doivent apparaître à côté du
// champ concerné, pas en haut du formulaire ». Celui-ci se place juste
// sous son champ, et il est relié à lui par son id (aria-describedby,
// posé sur le champ par useFieldValidation) : un lecteur d'écran le lit
// avec le nom du champ.
//
// aria-live="polite" sur un conteneur TOUJOURS présent (même vide) :
// quand le message apparaît, il est annoncé sans couper la parole —
// une zone live créée en même temps que son texte serait souvent muette.
// ══════════════════════════════════════════════════════════

/**
 * @param {{ id: string, children?: React.ReactNode }} props
 */
export default function FieldError({ id, children }) {
  return (
    <p
      id={id}
      aria-live="polite"
      style={{
        color: '#A8442F', fontSize: 14, fontWeight: 600, lineHeight: 1.4,
        margin: children ? '6px 0 0' : 0,
      }}
    >
      {children && (
        <>
          {/* Le symbole double la couleur : l'erreur se repère même sans
              distinguer le rouge (RGAA 3.1 — l'information ne repose
              jamais sur la couleur seule) */}
          <span aria-hidden="true">⚠ </span>
          {children}
        </>
      )}
    </p>
  );
}
