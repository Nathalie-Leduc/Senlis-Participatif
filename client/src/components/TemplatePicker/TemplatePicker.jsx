// ══════════════════════════════════════════════════════════
// Choix d'un modèle — premier bloc des formulaires de création
// (S5R2-12, recette du 08/10)
//
// Avant, « Partir d'un modèle » arrivait APRÈS le titre, la
// description, le public visé… : on remplissait tout avant de
// découvrir qu'un modèle aurait pu le faire. Désormais, c'est la
// première chose qu'on voit, dans l'enquête comme dans la proposition.
//
// Analogie : choisir le patron AVANT de couper le tissu, pas après.
//
// Un seul composant pour les deux formulaires : même apparence, même
// mise en valeur du modèle choisi (bordure + fond + coche, jamais la
// couleur seule — RGAA 3.1), même annonce aux lecteurs d'écran.
// La confirmation avant de remplacer un texte déjà saisi reste du
// ressort du formulaire (lui seul sait ce qui serait perdu).
// ══════════════════════════════════════════════════════════

/**
 * @param {object} props
 * @param {Array<{ id: string, name: string, summary: string }>} props.templates
 * @param {string | null} props.appliedId - modèle appliqué en dernier
 * @param {(template: object) => void} props.onApply
 * @param {string} props.appliedHint - ex. « Modèle appliqué : questions ci-dessous »
 * @param {string} [props.status] - phrase annoncée aux lecteurs d'écran après un choix
 * @param {string} [props.intro] - une phrase sous le titre du bloc
 */
export default function TemplatePicker({ templates, appliedId, onApply, appliedHint, status = '', intro }) {
  return (
    <section
      aria-labelledby="templates-title"
      style={{ background: '#FAF7F0', border: '2px solid #EFEBE2', borderRadius: 16, padding: 16 }}
    >
      <h2 id="templates-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: '0 0 4px' }}>
        Partir d'un modèle
      </h2>
      {intro && <p style={{ fontSize: 14, color: '#6B6257', margin: '0 0 12px' }}>{intro}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {templates.map((template) => {
          const applied = appliedId === template.id;
          return (
            <button
              key={template.id} type="button" onClick={() => onApply(template)}
              // aria-pressed : un lecteur d'écran annonce « bouton, enfoncé »
              aria-pressed={applied}
              style={{
                textAlign: 'left', borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                // Sans « inherit », un <button> prend la police du système
                fontFamily: 'inherit',
                background: applied ? '#E3EEF3' : '#fff',
                border: applied ? '3px solid #1E5F7C' : '2px solid #e3dcce',
              }}
            >
              <strong style={{ display: 'block', fontSize: 15, color: '#26333A' }}>
                {applied && <span aria-hidden="true">✓ </span>}{template.name}
              </strong>
              <span style={{ fontSize: 13, color: '#6B6257' }}>{template.summary}</span>
              {applied && (
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E5F7C', marginTop: 6 }}>
                  {appliedHint}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Annonce aux lecteurs d'écran : le contenu a changé plus bas */}
      <p role="status" className="sr-only">{status}</p>
    </section>
  );
}
