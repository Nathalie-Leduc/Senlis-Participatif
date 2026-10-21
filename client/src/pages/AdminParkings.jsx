// ══════════════════════════════════════════════════════════
// Page Admin — Parkings (S5R2-05) — /admin/parkings
//
// La liste des parkings de la carte, tenue par l'administration (et
// plus par OpenStreetMap) : ajouter, modifier, supprimer, et PLACER
// chaque parking d'un clic sur la carte.
//
// Les 19 parkings initiaux (plan 2023 + guide 2025) arrivent avec leur
// nom, leurs places et leur régime, mais sans position : un plan
// imprimé ne donne pas de coordonnées. Le travail ici : choisir un
// parking « à placer », cliquer à son emplacement sur la carte,
// enregistrer — une trentaine de secondes par parking.
// Recette du 20/10 : un parking peut avoir PLUSIEURS points (le stade)
// et des TRAITS le long des rues (zone rouge) — ParkingLocationsEditor.
//
// L'Admin-test (S5R2-11) voit la page en lecture seule : un parking
// n'est pas un brouillon.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import EditorBanner from '../components/EditorBanner/EditorBanner.jsx';
import ParkingPlaceMap from '../components/ParkingPlaceMap/ParkingPlaceMap.jsx';
import { PARKING_REGIMES, PARKING_CHARGING, regimeMeta } from '../constants/parkings.js';
import ParkingLocationsEditor from '../components/ParkingLocationsEditor/ParkingLocationsEditor.jsx';
import { EMPTY_PARKING_FORM, parkingToForm, parkingFormToPayload, locationsOf, describeLocations, toPosition } from '../utils/parkings.js';

export default function AdminParkings() {
  usePageTitle('Administration — Parkings');
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // null : rien en cours ; { id: null } : nouveau ; { id } : modification
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_PARKING_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all'); // all | unplaced

  useEffect(() => {
    api.get('/parkings/admin')
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message || 'Impossible de charger les parkings'))
      .finally(() => setLoading(false));
  }, []);

  const isPlaced = (p) => locationsOf(p).length > 0;
  const placedCount = items.filter(isPlaced).length;
  const shown = useMemo(() => (filter === 'unplaced' ? items.filter((p) => !isPlaced(p)) : items), [items, filter]);
  // Recette du 20/10 : outil de placement (points ou trait) et trait en cours
  const [mode, setMode] = useState('Point');
  const [draft, setDraft] = useState([]);

  const startEdit = (parking) => {
    if (!isAdmin) return;
    setEditing({ id: parking?.id ?? null });
    setForm(parking ? parkingToForm(parking) : EMPTY_PARKING_FORM);
    setFormError(null);
    setMode('Point');
    setDraft([]);
  };

  // Le formulaire s'ouvre en haut de la liste : on y emmène le regard ET
  // le focus clavier (un lecteur d'écran annonce son titre)
  const formTitleRef = useRef(null);
  useEffect(() => {
    if (!editing) return;
    formTitleRef.current?.focus();
    formTitleRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [editing]);
  const stopEdit = () => { setEditing(null); setFormError(null); setDraft([]); };

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  // Clic sur la carte : un point de plus, ou un sommet de plus au trait en cours
  const onMapClick = (latlng) => {
    if (mode === 'Point') setForm((f) => ({ ...f, locations: [...f.locations, { type: 'Point', coordinates: toPosition(latlng) }] }));
    else setDraft((d) => [...d, toPosition(latlng)]);
  };
  const setLocations = (locations) => setForm((f) => ({ ...f, locations }));

  const save = async (e) => {
    e.preventDefault();
    // Un trait commencé mais pas terminé : on le termine (2 points ou
    // plus) — avec un seul point, ce n'est pas encore un trait
    if (draft.length === 1) {
      setFormError('Le trait en cours n’a qu’un point : ajoutez-en un autre, ou abandonnez-le.');
      return;
    }
    const finalForm = draft.length > 1
      ? { ...form, locations: [...form.locations, { type: 'LineString', coordinates: draft }] }
      : form;
    setSaving(true);
    setFormError(null);
    try {
      const payload = parkingFormToPayload(finalForm);
      const data = editing.id
        ? await api.patch(`/parkings/${editing.id}`, payload)
        : await api.post('/parkings', payload);
      setItems((list) => {
        const others = list.filter((p) => p.id !== data.parking.id);
        return [...others, data.parking].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      });
      showToast(`« ${data.parking.name} » enregistré${isPlaced(data.parking) ? '' : ' (pas encore placé sur la carte)'}`);
      stopEdit();
    } catch (err) {
      // Détail Zod (champ par champ) s'il y en a, sinon le message général
      const details = err.details ? Object.values(err.details).join(' · ') : null;
      setFormError(details || err.message || "L'enregistrement a échoué");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (parking) => {
    if (!window.confirm(`Supprimer « ${parking.name} » ? Il disparaîtra de la carte.`)) return;
    try {
      await api.delete(`/parkings/${parking.id}`);
      setItems((list) => list.filter((p) => p.id !== parking.id));
      if (editing?.id === parking.id) stopEdit();
      showToast(`« ${parking.name} » supprimé`);
    } catch (err) {
      setError(err.message || 'La suppression a échoué');
    }
  };

  // Ce que montre la carte pour le parking en cours (emplacements non enregistrés compris)
  const editingOnMap = editing
    ? { id: editing.id, name: form.name, regime: form.regime || null, charging: form.charging, locations: form.locations, draft }
    : null;

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28 }}>Administration — Parkings</h1>
        {isAdmin && !editing && (
          <button type="button" className="btn btn-primary" onClick={() => startEdit(null)}>+ Ajouter un parking</button>
        )}
      </div>
      <p style={{ color: '#6B6257', marginBottom: 18 }}>
        {items.length} parking{items.length > 1 ? 's' : ''} · <strong>{placedCount}</strong> placé{placedCount > 1 ? 's' : ''} sur la carte publique
        {items.length > placedCount && ` · ${items.length - placedCount} à placer`}
      </p>

      <EditorBanner />
      {!isAdmin && (
        <p role="note" style={{ fontSize: 14, color: '#6B6257', marginBottom: 16 }}>Consultation seule : les parkings sont modifiés par l'administration.</p>
      )}
      {error && <p role="alert" style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12 }}>{error}</p>}

      <div className="admin-parkings">
        {/* ── La carte ─────────────────────────────────── */}
        <div className="admin-parkings__map">
          <ParkingPlaceMap
            parkings={items}
            editing={editingOnMap}
            onMapClick={isAdmin ? onMapClick : undefined}
            onSelect={isAdmin ? startEdit : undefined}
          />
          <p style={{ fontSize: 13, color: '#6B6257', marginTop: 6 }}>
            {editing
              ? (mode === 'Point'
                ? '📍 Chaque clic sur la carte ajoute un emplacement (zoomez pour plus de précision), puis enregistrez.'
                : '〰️ Cliquez le long de la rue pour tracer les places, puis « Terminer le trait » et enregistrez.')
              : 'Choisissez un parking dans la liste (ou cliquez sur son repère) pour le modifier ou le placer.'}
          </p>
        </div>

        <div>
          {/* ── Le formulaire (ajout ou modification) ───── */}
          {editing && (
            <form onSubmit={save} className="card-joyful" style={{ padding: 18, marginBottom: 18 }} aria-labelledby="parking-form-title">
              <h2 id="parking-form-title" ref={formTitleRef} tabIndex={-1} style={{ fontSize: 18, marginBottom: 12, outline: 'none' }}>
                {editing.id ? `Modifier « ${items.find((p) => p.id === editing.id)?.name} »` : 'Nouveau parking'}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <Field label="Nom" wide>
                  <input name="name" value={form.name} onChange={change} required minLength={2} maxLength={120} style={input} />
                </Field>
                <Field label="Places">
                  <input name="places" type="number" min="0" value={form.places} onChange={change} style={input} />
                </Field>
                <Field label="Dont places PMR">
                  <input name="pmrPlaces" type="number" min="0" value={form.pmrPlaces} onChange={change} style={input} />
                </Field>
                <Field label="Régime" wide>
                  <select name="regime" value={form.regime} onChange={change} style={input}>
                    <option value="">À préciser</option>
                    {Object.entries(PARKING_REGIMES).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                  </select>
                </Field>
                <Field label="Recharge électrique">
                  <select name="charging" value={form.charging} onChange={change} style={input}>
                    {Object.entries(PARKING_CHARGING).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Points de recharge">
                  <input name="chargingPoints" type="number" min="0" value={form.chargingPoints} onChange={change} disabled={form.charging === 'AUCUNE'} style={input} />
                </Field>
                <Field label="Remarque (facultatif)" wide>
                  <textarea name="note" value={form.note} onChange={change} maxLength={300} rows={2} style={{ ...input, resize: 'vertical' }} />
                </Field>
              </div>

              {/* Recette du 20/10 : plusieurs points, et des traits le long des rues */}
              <ParkingLocationsEditor
                locations={form.locations}
                mode={mode}
                draft={draft}
                onModeChange={(next) => { setMode(next); setDraft([]); }}
                onLocationsChange={setLocations}
                onDraftChange={setDraft}
              />

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
                <button type="button" className="btn" onClick={stopEdit} style={{ background: '#fff', border: '2px solid #e3dcce', color: '#26333A' }}>Annuler</button>
                {/* L'erreur s'affiche ici, à côté du bouton (recette du 13/10) */}
                {formError && <p role="alert" style={{ margin: 0, color: '#A8442F', fontWeight: 600, flex: '1 1 220px' }}>{formError}</p>}
              </div>
            </form>
          )}

          {/* ── La liste ───────────────────────────────────── */}
          <div role="group" aria-label="Filtrer la liste" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[['all', 'Tous'], ['unplaced', `À placer (${items.length - placedCount})`]].map(([value, label]) => (
              <button
                key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 36,
                  border: `2px solid ${filter === value ? '#1E5F7C' : '#e3dcce'}`,
                  background: filter === value ? '#1E5F7C' : '#fff', color: filter === value ? '#fff' : '#26333A',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? <p style={{ color: '#6B6257' }}>Chargement…</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map((p) => {
                const meta = regimeMeta(p.regime);
                return (
                  <li key={p.id} className="card-joyful" style={{
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    outline: editing?.id === p.id ? '3px solid #D4A84A' : 'none',
                  }}>
                    <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 5, background: meta.bg, color: meta.fg, fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      {meta.letter}
                    </span>
                    <span style={{ flex: '1 1 200px' }}>
                      <strong>{p.name}</strong>
                      <span style={{ display: 'block', fontSize: 13, color: '#6B6257' }}>
                        {p.places ? `${p.places} places` : 'places ?'} · {meta.label}
                        {p.charging !== 'AUCUNE' && ` · ⚡ ${PARKING_CHARGING[p.charging].toLowerCase()}`}
                      </span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isPlaced(p) ? '#3A7A4D' : '#8A5A00' }}>
                      {isPlaced(p) ? `📍 ${describeLocations(locationsOf(p))}` : 'à placer'}
                    </span>
                    {isAdmin && (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn" onClick={() => startEdit(p)} aria-label={`Modifier ou placer « ${p.name} »`}
                          style={{ background: '#E3EEF3', color: '#1E5F7C', padding: '6px 12px', minHeight: 36, fontSize: 13 }}>
                          {isPlaced(p) ? 'Modifier' : 'Placer'}
                        </button>
                        <button type="button" className="btn" onClick={() => remove(p)} aria-label={`Supprimer « ${p.name} »`}
                          style={{ background: '#FCEAE6', color: '#A8442F', padding: '6px 12px', minHeight: 36, fontSize: 13 }}>
                          Supprimer
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
              {shown.length === 0 && <li style={{ color: '#6B6257' }}>{filter === 'unplaced' ? 'Tous les parkings sont placés 🎉' : 'Aucun parking pour le moment.'}</li>}
            </ul>
          )}
        </div>
      </div>

      <style>{`
        .admin-parkings { display: grid; gap: 20px; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); align-items: start; }
        .admin-parkings__map { position: sticky; top: 90px; }
        @media (max-width: 900px) {
          .admin-parkings { grid-template-columns: 1fr; }
          .admin-parkings__map { position: static; }
        }
      `}</style>
    </div>
  );
}

const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '2px solid #e3dcce', fontSize: 14, font: 'inherit' };

function Field({ label, wide, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontWeight: 600, fontSize: 13, gridColumn: wide ? '1 / -1' : 'auto' }}>
      {label}
      {children}
    </label>
  );
}
