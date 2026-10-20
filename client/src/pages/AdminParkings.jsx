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
import { EMPTY_PARKING_FORM, parkingToForm, parkingFormToPayload, formPosition } from '../utils/parkings.js';

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

  const placedCount = items.filter((p) => p.lat !== null).length;
  const shown = useMemo(() => (filter === 'unplaced' ? items.filter((p) => p.lat === null) : items), [items, filter]);

  const startEdit = (parking) => {
    if (!isAdmin) return;
    setEditing({ id: parking?.id ?? null });
    setForm(parking ? parkingToForm(parking) : EMPTY_PARKING_FORM);
    setFormError(null);
  };

  // Le formulaire s'ouvre en haut de la liste : on y emmène le regard ET
  // le focus clavier (un lecteur d'écran annonce son titre)
  const formTitleRef = useRef(null);
  useEffect(() => {
    if (!editing) return;
    formTitleRef.current?.focus();
    formTitleRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [editing]);
  const stopEdit = () => { setEditing(null); setFormError(null); };

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  // Clic sur la carte → coordonnées (gardées en TEXTE dans le formulaire,
  // comme si on les avait tapées : un seul format à gérer)
  const place = ({ lat, lng }) => setForm((f) => ({ ...f, lat: lat === null ? '' : String(lat), lng: lng === null ? '' : String(lng) }));
  const position = formPosition(form); // { lat, lng } en nombres, ou null

  const save = async (e) => {
    e.preventDefault();
    // Une coordonnée tapée mais illisible (« 49,2a ») deviendrait null à
    // l'envoi (JSON ne connaît pas NaN) : la position serait effacée sans
    // prévenir. On arrête avant.
    if ((form.lat.trim() || form.lng.trim()) && !position) {
      setFormError('Coordonnées illisibles : saisissez deux nombres (ex. 49.2066 et 2.5866), ou cliquez sur la carte.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = parkingFormToPayload(form);
      const data = editing.id
        ? await api.patch(`/parkings/${editing.id}`, payload)
        : await api.post('/parkings', payload);
      setItems((list) => {
        const others = list.filter((p) => p.id !== data.parking.id);
        return [...others, data.parking].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      });
      showToast(`« ${data.parking.name} » enregistré${data.parking.lat !== null ? '' : ' (pas encore placé sur la carte)'}`);
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

  // Ce que montre la carte pour le parking en cours (position non enregistrée comprise)
  const editingOnMap = editing
    ? { ...form, id: editing.id, regime: form.regime || null, lat: position?.lat ?? null, lng: position?.lng ?? null }
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
            onPlace={isAdmin ? place : undefined}
            onSelect={isAdmin ? startEdit : undefined}
          />
          <p style={{ fontSize: 13, color: '#6B6257', marginTop: 6 }}>
            {editing
              ? '📍 Cliquez sur la carte à l’emplacement du parking (zoomez pour plus de précision), puis enregistrez.'
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

              <fieldset style={{ border: '2px solid #EFEBE2', borderRadius: 12, padding: '10px 12px', marginTop: 12 }}>
                <legend style={{ fontWeight: 600, fontSize: 14, padding: '0 6px' }}>Position sur la carte</legend>
                <p style={{ fontSize: 13, color: '#6B6257', margin: '0 0 8px' }}>
                  {position ? '📍 Placé — cliquez ailleurs sur la carte pour le déplacer.' : 'Pas encore placé : cliquez sur la carte. (Ou saisissez les coordonnées.)'}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <Field label="Latitude">
                    <input name="lat" inputMode="decimal" value={form.lat} onChange={change} placeholder="49.2066" style={input} />
                  </Field>
                  <Field label="Longitude">
                    <input name="lng" inputMode="decimal" value={form.lng} onChange={change} placeholder="2.5866" style={input} />
                  </Field>
                  {(form.lat !== '' || form.lng !== '') && (
                    <button type="button" className="btn" onClick={() => place({ lat: null, lng: null })} style={{ background: '#EFEBE2', color: '#26333A', minHeight: 40 }}>
                      Retirer de la carte
                    </button>
                  )}
                </div>
              </fieldset>

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
                    <span style={{ fontSize: 13, fontWeight: 600, color: p.lat !== null ? '#3A7A4D' : '#8A5A00' }}>
                      {p.lat !== null ? '📍 placé' : 'à placer'}
                    </span>
                    {isAdmin && (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn" onClick={() => startEdit(p)} aria-label={`Modifier ou placer « ${p.name} »`}
                          style={{ background: '#E3EEF3', color: '#1E5F7C', padding: '6px 12px', minHeight: 36, fontSize: 13 }}>
                          {p.lat !== null ? 'Modifier' : 'Placer'}
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
