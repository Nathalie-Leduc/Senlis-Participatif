// ══════════════════════════════════════════════════════════
// Emplacements d'un parking (recette du 20/10) — sous le formulaire
// de l'écran « Parkings », à côté de la carte de placement.
//
// Deux outils, au choix :
//  - 📍 Points : chaque clic sur la carte ajoute un emplacement (le
//    stade a plusieurs aires : un point par aire) ;
//  - 〰️ Trait : chaque clic ajoute un sommet ; « Terminer le trait »
//    l'ajoute aux emplacements (places le long d'une rue, zone rouge).
// Puis la liste des emplacements, chacun retirable, et une saisie des
// coordonnées au clavier (alternative à la souris).
//
// Ce composant ne garde AUCUN état : tout vit dans la page (le
// formulaire et le trait en cours), qui le partage avec la carte.
// ══════════════════════════════════════════════════════════

import { useState } from 'react';
import { describeLocations, lineLength, parseLatLng, toPosition } from '../../utils/parkings.js';

const fmt = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 5 });

/**
 * @param {object} props
 * @param {Array<object>} props.locations - points et traits (GeoJSON)
 * @param {'Point'|'LineString'} props.mode
 * @param {Array<[number, number]>} props.draft - sommets du trait en cours (GeoJSON)
 * @param {(mode: 'Point'|'LineString') => void} props.onModeChange
 * @param {(locations: Array<object>) => void} props.onLocationsChange
 * @param {(draft: Array<[number, number]>) => void} props.onDraftChange
 */
export default function ParkingLocationsEditor({ locations, mode, draft, onModeChange, onLocationsChange, onDraftChange }) {
  const [manual, setManual] = useState({ lat: '', lng: '' });
  const [manualError, setManualError] = useState(null);

  const finishLine = () => {
    onLocationsChange([...locations, { type: 'LineString', coordinates: draft }]);
    onDraftChange([]);
  };
  const removeAt = (index) => onLocationsChange(locations.filter((_, i) => i !== index));

  // Saisie au clavier : un point, ou un sommet du trait en cours
  const addManual = () => {
    const point = parseLatLng(manual.lat, manual.lng);
    if (!point) {
      setManualError('Coordonnées illisibles : deux nombres, ex. 49.2066 et 2.5866.');
      return;
    }
    setManualError(null);
    if (mode === 'Point') onLocationsChange([...locations, { type: 'Point', coordinates: toPosition(point) }]);
    else onDraftChange([...draft, toPosition(point)]);
    setManual({ lat: '', lng: '' });
  };

  return (
    <fieldset style={{ border: '2px solid #EFEBE2', borderRadius: 12, padding: '10px 12px', marginTop: 12 }}>
      <legend style={{ fontWeight: 600, fontSize: 14, padding: '0 6px' }}>
        Emplacements sur la carte <span style={{ fontWeight: 400, color: '#6B6257' }}>({describeLocations(locations)})</span>
      </legend>

      <div role="group" aria-label="Outil de placement" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {[['Point', '📍 Ajouter des points'], ['LineString', '〰️ Tracer un trait']].map(([value, label]) => (
          <button
            key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)}
            style={{
              padding: '6px 12px', minHeight: 36, borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `2px solid ${mode === value ? '#1E5F7C' : '#e3dcce'}`,
              background: mode === value ? '#1E5F7C' : '#fff', color: mode === value ? '#fff' : '#26333A',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 13, color: '#6B6257', margin: '0 0 8px' }} aria-live="polite">
        {mode === 'Point'
          ? 'Chaque clic sur la carte ajoute un emplacement (ex. une aire du parking).'
          : draft.length === 0
            ? 'Cliquez le long de la rue, du début à la fin des places : chaque clic ajoute un point du trait.'
            : `Trait en cours : ${draft.length} point${draft.length > 1 ? 's' : ''}${draft.length > 1 ? ` (${lineLength(draft)} m)` : ''}.`}
      </p>

      {mode === 'LineString' && draft.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" className="btn btn-primary" onClick={finishLine} disabled={draft.length < 2} style={{ padding: '6px 12px', minHeight: 36, fontSize: 13 }}>
            Terminer le trait
          </button>
          <button type="button" className="btn" onClick={() => onDraftChange(draft.slice(0, -1))} style={smallBtn}>
            ↶ Retirer le dernier point
          </button>
          <button type="button" className="btn" onClick={() => onDraftChange([])} style={smallBtn}>
            Abandonner ce trait
          </button>
        </div>
      )}

      {locations.length > 0 && (
        <ol style={{ margin: '0 0 10px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {locations.map((g, i) => (
            <li key={i} style={{ fontSize: 13 }}>
              {g.type === 'Point'
                ? `Point — ${fmt(g.coordinates[1])}, ${fmt(g.coordinates[0])}`
                : `Trait — ${g.coordinates.length} points, ${lineLength(g.coordinates)} m`}
              <button
                type="button" onClick={() => removeAt(i)} aria-label={`Retirer l'emplacement ${i + 1}`}
                style={{ marginLeft: 8, background: 'none', border: 'none', padding: 0, color: '#A8442F', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}
              >
                retirer
              </button>
            </li>
          ))}
        </ol>
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>Saisir des coordonnées au clavier</summary>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
          <label style={label}>
            Latitude
            <input inputMode="decimal" value={manual.lat} onChange={(e) => setManual((m) => ({ ...m, lat: e.target.value }))} placeholder="49.2066" style={input} />
          </label>
          <label style={label}>
            Longitude
            <input inputMode="decimal" value={manual.lng} onChange={(e) => setManual((m) => ({ ...m, lng: e.target.value }))} placeholder="2.5866" style={input} />
          </label>
          <button type="button" className="btn" onClick={addManual} style={smallBtn}>
            {mode === 'Point' ? 'Ajouter ce point' : 'Ajouter au trait'}
          </button>
        </div>
        {manualError && <p role="alert" style={{ margin: '6px 0 0', color: '#A8442F', fontSize: 13, fontWeight: 600 }}>{manualError}</p>}
      </details>

      {locations.length > 0 && (
        <button type="button" className="btn" onClick={() => onLocationsChange([])} style={{ ...smallBtn, marginTop: 10 }}>
          Tout retirer de la carte
        </button>
      )}
    </fieldset>
  );
}

const smallBtn = { background: '#EFEBE2', color: '#26333A', padding: '6px 12px', minHeight: 36, fontSize: 13 };
const label = { display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 600, fontSize: 13 };
const input = { width: 130, padding: '8px 10px', borderRadius: 8, border: '2px solid #e3dcce', fontSize: 14, font: 'inherit' };
