// ══════════════════════════════════════════════════════════
// Choix du public visé d'une enquête (S5R-07)
//
// Remplace la liste déroulante TOUS / RÉSIDENTS / COMMERÇANTS par des
// cases à cocher, en deux familles (reliées par un OU) :
//  - Où résident-ils ? centre historique / autres quartiers (lesquels)
//    / hors Senlis ;
//  - Où travaillent-ils ? quartier(s) de travail et rôle(s).
// Rien de coché = tout le monde. Une phrase de synthèse, sous les cases,
// relit le choix en français (« S'adresse à : … ») : l'administratrice
// voit exactement ce que les citoyens liront.
// ══════════════════════════════════════════════════════════

import { QUARTIER_OPTIONS, TRAVAIL_QUARTIER_OPTIONS } from '../../constants/situation.js';
import { describeAudience } from '../../utils/audience.js';

const RESIDENCES = [
  { value: 'CENTRE_RESIDENT', label: 'Habitants du centre historique' },
  { value: 'AUTRE_QUARTIER', label: 'Habitants des autres quartiers de Senlis' },
  { value: 'HORS_SENLIS', label: 'Personnes qui résident hors de Senlis' },
];
const ROLES = [
  { value: 'COMMERCANT', label: 'Qui dirigent ou gèrent une activité' },
  { value: 'SALARIE', label: 'Salarié·es' },
];

/**
 * Une case à cocher avec son libellé. Déclarée HORS du composant
 * principal : définie à l'intérieur, React la recréerait à chaque
 * rendu, démonterait la case à chaque clic… et le focus clavier
 * sauterait (la barre d'espace ne cocherait qu'une case à la fois).
 */
function Check({ checked, onToggle, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, padding: '3px 0' }}>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ width: 18, height: 18 }} />
      {children}
    </label>
  );
}

/** Coche / décoche une valeur dans une liste */
const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * @param {{ value: { situations: string[], quartiers: string[], workQuartiers: string[], workTypes: string[] },
 *   onChange: (audience) => void }} props
 */
export default function AudiencePicker({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <fieldset style={{ border: '2px solid #e3dcce', borderRadius: 12, padding: '12px 16px', margin: 0 }}>
      <legend style={{ fontWeight: 600, fontSize: 15, padding: '0 6px' }}>Public visé</legend>
      <p style={{ fontSize: 13, color: '#6B6257', margin: '0 0 10px' }}>
        Rien de coché = tout le monde. Le public visé est annoncé aux citoyens, sans empêcher personne de répondre.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div role="group" aria-labelledby="audience-residence">
          <p id="audience-residence" style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px' }}>Selon leur lieu de résidence</p>
          {RESIDENCES.map((r) => (
            <div key={r.value}>
              <Check
                checked={value.situations.includes(r.value)}
                onToggle={() => {
                  const situations = toggle(value.situations, r.value);
                  // Décocher « autres quartiers » efface aussi le détail des quartiers
                  set({ situations, quartiers: situations.includes('AUTRE_QUARTIER') ? value.quartiers : [] });
                }}
              >
                {r.label}
              </Check>
              {r.value === 'AUTRE_QUARTIER' && value.situations.includes('AUTRE_QUARTIER') && (
                <div role="group" aria-label="Quels quartiers ?" style={{ marginLeft: 26, fontSize: 14 }}>
                  <p style={{ fontSize: 13, color: '#6B6257', margin: '2px 0' }}>Lesquels ? (aucun coché = tous)</p>
                  {QUARTIER_OPTIONS.map((q) => (
                    <Check key={q.value} checked={value.quartiers.includes(q.value)} onToggle={() => set({ quartiers: toggle(value.quartiers, q.value) })}>
                      {q.label}
                    </Check>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div role="group" aria-labelledby="audience-travail">
          <p id="audience-travail" style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px' }}>Selon leur lieu de travail</p>
          <p style={{ fontSize: 13, color: '#6B6257', margin: '0 0 4px' }}>Quartier(s) de travail (aucun = n'importe où à Senlis)</p>
          {TRAVAIL_QUARTIER_OPTIONS.map((q) => (
            <Check key={q.value} checked={value.workQuartiers.includes(q.value)} onToggle={() => set({ workQuartiers: toggle(value.workQuartiers, q.value) })}>
              {q.label}
            </Check>
          ))}
          <p style={{ fontSize: 13, color: '#6B6257', margin: '8px 0 4px' }}>Rôle (aucun = tous)</p>
          {ROLES.map((r) => (
            <Check key={r.value} checked={value.workTypes.includes(r.value)} onToggle={() => set({ workTypes: toggle(value.workTypes, r.value) })}>
              {r.label}
            </Check>
          ))}
        </div>
      </div>

      {/* aria-live : la synthèse est relue à chaque case cochée */}
      <p aria-live="polite" style={{ marginTop: 12, fontSize: 14, background: '#F6F1E7', borderRadius: 10, padding: '8px 12px' }}>
        <strong>S'adresse à :</strong> {describeAudience(value)}
      </p>
    </fieldset>
  );
}
