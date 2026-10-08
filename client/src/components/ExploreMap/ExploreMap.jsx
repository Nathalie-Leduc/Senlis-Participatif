// ══════════════════════════════════════════════════════════
// Carte « Explorer » (S5R-11, v2 après les retours du 07/10)
//
// Recette du 30/09 : « Explorer la carte » ne montrait que les
// propositions, jamais les enquêtes. Retours du 07/10 sur la v1 :
//  - par défaut, TOUTE LA VILLE (et non le centre historique) ;
//  - pouvoir cocher UN OU PLUSIEURS quartiers ;
//  - voir sur la carte les propositions ET les enquêtes, même sans
//    point précis (elles sont placées au centre de leurs quartiers) ;
//  - un vrai plein écran.
//
// La carte et une LISTE vont ensemble : la liste est l'alternative
// accessible (la carte reste difficile au clavier et au lecteur d'écran).
//
// Analogie : le plan d'un centre commercial avec, à côté, l'annuaire
// des boutiques — on cherche sur le plan ou dans la liste, et on peut
// n'afficher qu'un ou deux étages.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import LazyMapView from '../MapView/LazyMapView.jsx';
import { ZONE_QUARTIERS } from '../../constants/zones.js';
import { loadIris } from '../../utils/irisData.js';
import { loadParkings, parkingMarkers } from '../../utils/osmParkings.js';
import { itemsForSelection, irisCentroids, mapMarkers, unplacedProposals } from '../../utils/explore.js';

const SENLIS_CENTER = [49.2058, 2.5847];
const codeOf = (q) => ZONE_QUARTIERS.find((z) => z.value === q)?.codeIris;

/**
 * @param {{ height?: number|string, fullPage?: boolean }} props
 *   fullPage : la page /carte — la carte occupe toute la hauteur disponible
 */
export default function ExploreMap({ height = 420, fullPage = false }) {
  const [proposals, setProposals] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [iris, setIris] = useState(null);
  const [parkings, setParkings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // [] = toute la ville (défaut) ; sinon les quartiers cochés
  const [selected, setSelected] = useState([]);
  const [layers, setLayers] = useState({ proposals: true, surveys: true, parkings: false });

  const containerRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      // Seulement ce qui est EN COURS : propositions publiées, enquêtes ouvertes
      api.get('/proposals?status=PUBLISHED&limit=50').then((d) => d.items).catch(() => []),
      api.get('/surveys?status=OPEN&limit=50').then((d) => d.items).catch(() => []),
      loadIris(),
      loadParkings(),
    ]).then(([p, s, i, k]) => {
      if (cancelled) return;
      setProposals(p);
      setSurveys(s);
      setIris(i);
      setParkings(k);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Plein écran : on suit l'état réel du navigateur (Échap en sort aussi)
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else containerRef.current?.requestFullscreen?.();
  };

  const toggleQuartier = (q) => setSelected((list) => (list.includes(q) ? list.filter((v) => v !== q) : [...list, q]));
  const handleIrisClick = (code) => {
    const match = ZONE_QUARTIERS.find((z) => z.codeIris === code);
    if (match) toggleQuartier(match.value);
  };

  const items = useMemo(() => itemsForSelection(selected, proposals, surveys), [selected, proposals, surveys]);
  const unplaced = useMemo(() => unplacedProposals(proposals), [proposals]);
  const centroids = useMemo(() => irisCentroids(iris), [iris]);
  const markers = useMemo(() => mapMarkers({
    proposals: layers.proposals ? items.proposals : [],
    surveys: layers.surveys ? items.surveys : [],
    centroids, codeOf, selected, cityCenter: SENLIS_CENTER,
  }), [items, layers, centroids, selected]);
  const parkingList = useMemo(() => parkingMarkers(parkings), [parkings]);

  const setLayer = (key) => (e) => setLayers((l) => ({ ...l, [key]: e.target.checked }));
  const selectionLabel = selected.length === 0
    ? 'Toute la ville'
    : ZONE_QUARTIERS.filter((q) => selected.includes(q.value)).map((q) => q.label).join(', ');

  return (
    <div ref={containerRef} className={`explore-map${fullPage ? ' explore-map--full' : ''}${fullscreen ? ' explore-map--fullscreen' : ''}`}>
      <div className="explore-map__map">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <Toggle checked={layers.proposals} onChange={setLayer('proposals')} label="🦌 Propositions" />
          <Toggle checked={layers.surveys} onChange={setLayer('surveys')} label="❓ Enquêtes ouvertes" />
          {parkingList.length > 0 && (
            <Toggle checked={layers.parkings} onChange={setLayer('parkings')} label={`🅿️ Parkings (${parkingList.length})`} />
          )}
          <button type="button" onClick={toggleFullscreen} className="btn" style={{ marginLeft: 'auto', padding: '6px 14px', minHeight: 40 }}>
            {fullscreen ? '✕ Quitter le plein écran' : '⛶ Plein écran'}
          </button>
        </div>
        {loaded ? (
          <LazyMapView
            center={SENLIS_CENTER}
            zoom={14}
            iris={iris}
            neutralIris
            selectedIris={selected.map(codeOf)}
            onIrisClick={handleIrisClick}
            markers={markers}
            parkings={layers.parkings ? parkingList : []}
            // Plein écran : toute la hauteur de l'écran ; page /carte : la
            // hauteur de la fenêtre moins l'en-tête du site (dvh : tient
            // compte de la barre d'adresse mobile)
            height={fullscreen ? 'calc(100vh - 110px)' : fullPage ? 'calc(100dvh - 230px)' : height}
          />
        ) : (
          <p style={{ color: '#6B6257' }}>Chargement de la carte…</p>
        )}
        <p style={{ fontSize: 13, color: '#6B6257', marginTop: 6 }}>
          Cliquez sur un quartier pour l'ajouter ou le retirer de la sélection.
          {layers.parkings && parkings?.source && ` Parkings : ${parkings.source}.`}
        </p>
      </div>

      {/* ── Sélection et liste (alternative accessible à la carte) ── */}
      <section aria-labelledby="explore-title" className="card-joyful explore-map__panel" style={{ padding: 20 }}>
        <h3 id="explore-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 10 }}>Par quartier</h3>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 14px' }}>
          <legend className="sr-only">Quartiers affichés</legend>
          <label style={checkStyle}>
            <input type="checkbox" checked={selected.length === 0} onChange={() => setSelected([])} disabled={selected.length === 0} />
            <strong>Toute la ville</strong>
          </label>
          {ZONE_QUARTIERS.map((q) => (
            <label key={q.value} style={checkStyle}>
              <input type="checkbox" checked={selected.includes(q.value)} onChange={() => toggleQuartier(q.value)} />
              {q.label}
            </label>
          ))}
        </fieldset>

        {/* aria-live : la liste change quand on coche un quartier (aussi depuis la carte) */}
        <div aria-live="polite">
          <p style={{ fontSize: 14, marginBottom: 10 }}><strong>Affiché :</strong> {selectionLabel}</p>
          <ItemList title="Enquêtes ouvertes" items={items.surveys} empty="Aucune enquête ouverte ici." href={(s) => `/enquetes/${s.slug}`} />
          <ItemList title="Propositions" items={items.proposals} empty="Aucune proposition ici." href={(p) => `/propositions/${p.slug}`} />
          {unplaced.length > 0 && selected.length > 0 && (
            <p style={{ fontSize: 13, color: '#6B6257', marginTop: 10 }}>
              + {unplaced.length} proposition{unplaced.length > 1 ? 's' : ''} sans quartier précis :{' '}
              <Link to="/propositions">toutes les propositions</Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

const checkStyle = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '3px 0' };

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

/** Une liste titrée ; les éléments « toute la ville » sont signalés */
function ItemList({ title, items, empty, href }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h4 style={{ fontSize: 15, margin: '0 0 6px' }}>{title} ({items.length})</h4>
      {items.length === 0 ? (
        <p style={{ fontSize: 14, color: '#6B6257' }}>{empty}</p>
      ) : (
        <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item) => (
            <li key={item.id} style={{ fontSize: 14 }}>
              <Link to={href(item)}>{item.title}</Link>
              {item.wholeCity && <span style={{ color: '#6B6257' }}> — toute la ville</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
