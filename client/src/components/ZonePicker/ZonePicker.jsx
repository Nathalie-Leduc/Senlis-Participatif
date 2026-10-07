// ══════════════════════════════════════════════════════════
// Choix de la zone concernée par une proposition (S5R-10)
//
// Recette du 30/09 : « choisir toute la ville ou des quartiers, plutôt
// que de saisir latitude et longitude ». Trois possibilités :
//  - aucune zone particulière ;
//  - toute la ville ;
//  - un ou plusieurs quartiers (les 7 IRIS de l'INSEE).
// Une phrase de synthèse relit le choix (« Concerne : … »), exactement
// comme les citoyens la liront sur la page de la proposition.
// ══════════════════════════════════════════════════════════

import { ZONE_QUARTIERS, describeZone } from '../../constants/zones.js';

const MODES = [
  { value: 'none', label: 'Pas de zone particulière' },
  { value: 'city', label: 'Toute la ville' },
  { value: 'quartiers', label: 'Un ou plusieurs quartiers' },
];

/**
 * @param {{ mode: 'none'|'city'|'quartiers', quartiers: string[],
 *   onChange: (next: { mode: string, quartiers: string[] }) => void }} props
 */
export default function ZonePicker({ mode, quartiers, onChange }) {
  const toggleQuartier = (q) => onChange({
    mode,
    quartiers: quartiers.includes(q) ? quartiers.filter((v) => v !== q) : [...quartiers, q],
  });
  const summary = describeZone({ zoneWholeCity: mode === 'city', zoneQuartiers: mode === 'quartiers' ? quartiers : [] });

  return (
    <fieldset style={{ border: '2px solid #e3dcce', borderRadius: 12, padding: '12px 16px', margin: 0 }}>
      <legend style={{ fontWeight: 600, fontSize: 15, padding: '0 6px' }}>Zone concernée</legend>
      {MODES.map((m) => (
        <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, padding: '3px 0' }}>
          <input type="radio" name="zone-mode" value={m.value} checked={mode === m.value} onChange={() => onChange({ mode: m.value, quartiers })} />
          {m.label}
        </label>
      ))}

      {mode === 'quartiers' && (
        <div role="group" aria-label="Quartiers concernés" style={{ marginLeft: 26, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
          {ZONE_QUARTIERS.map((q) => (
            <label key={q.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '3px 0' }}>
              <input type="checkbox" checked={quartiers.includes(q.value)} onChange={() => toggleQuartier(q.value)} style={{ width: 18, height: 18 }} />
              {q.label}
            </label>
          ))}
        </div>
      )}

      {/* La synthèse, telle que les citoyens la liront */}
      <p aria-live="polite" style={{ marginTop: 10, fontSize: 14, background: '#F6F1E7', borderRadius: 10, padding: '8px 12px' }}>
        <strong>Concerne :</strong> {summary ?? (mode === 'quartiers' ? 'cochez au moins un quartier' : 'pas de zone particulière')}
      </p>
    </fieldset>
  );
}
