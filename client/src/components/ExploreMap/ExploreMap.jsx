// ══════════════════════════════════════════════════════════
// Carte « Explorer » (S5R-11)
//
// Recette du 30/09 : « Explorer la carte » menait aux propositions,
// jamais aux enquêtes ; on veut voir, quartier par quartier, tout ce
// qui est en cours — et les vrais parkings.
//
// La carte et une LISTE vont ensemble :
//  - cliquer un quartier sur la carte, OU le choisir dans la liste
//    déroulante, affiche à côté ce qui le concerne : propositions
//    publiées et enquêtes ouvertes (celles de « toute la ville » à part) ;
//  - la liste est l'alternative accessible à la carte (déclaration
//    d'accessibilité : la carte reste difficile au clavier et au lecteur
//    d'écran — la liste, non).
//
// Analogie : le plan d'un centre commercial avec, à côté, l'annuaire
// des boutiques par étage. On peut chercher sur le plan, ou dans la liste.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import LazyMapView from '../MapView/LazyMapView.jsx';
import { ZONE_QUARTIERS } from '../../constants/zones.js';
import { loadIris } from '../../utils/irisData.js';
import { loadParkings, parkingMarkers } from '../../utils/osmParkings.js';
import { itemsForQuartier, unplacedProposals } from '../../utils/explore.js';

const SENLIS_CENTER = [49.2058, 2.5847];

/**
 * @param {{ height?: number }} props
 */
export default function ExploreMap({ height = 420 }) {
  const [proposals, setProposals] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [iris, setIris] = useState(null);
  const [parkings, setParkings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [quartier, setQuartier] = useState('CENTRE_HISTORIQUE');
  const [showParkings, setShowParkings] = useState(true);
  const [showProposals, setShowProposals] = useState(true);

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

  const selected = ZONE_QUARTIERS.find((q) => q.value === quartier);
  const items = useMemo(() => itemsForQuartier(quartier, proposals, surveys), [quartier, proposals, surveys]);
  const unplaced = useMemo(() => unplacedProposals(proposals), [proposals]);
  const parkingList = useMemo(() => parkingMarkers(parkings), [parkings]);
  const proposalMarkers = proposals
    .filter((p) => p.lat && p.lng)
    .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: p.title, slug: p.slug }));

  // Clic sur la carte : code IRIS → quartier
  const handleIrisClick = (code) => {
    const match = ZONE_QUARTIERS.find((q) => q.codeIris === code);
    if (match) setQuartier(match.value);
  };

  const checkbox = (checked, onChange, label) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    // Mise en page dans styles/global.scss (.explore-map) : carte et liste
    // côte à côte sur grand écran, l'une sous l'autre sur mobile
    <div className="explore-map">
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 10 }}>
          {checkbox(showProposals, setShowProposals, '📍 Propositions localisées')}
          {parkingList.length > 0 && checkbox(showParkings, setShowParkings, `🅿️ Parkings (${parkingList.length})`)}
        </div>
        {loaded ? (
          <LazyMapView
            center={SENLIS_CENTER}
            zoom={14}
            iris={iris}
            selectedIris={selected?.codeIris}
            onIrisClick={handleIrisClick}
            markers={showProposals ? proposalMarkers : []}
            parkings={showParkings ? parkingList : []}
            height={height}
          />
        ) : (
          <p style={{ color: '#6B6257' }}>Chargement de la carte…</p>
        )}
        <p style={{ fontSize: 13, color: '#6B6257', marginTop: 6 }}>
          Cliquez sur un quartier pour voir ce qui le concerne.
          {parkings?.source && ` Parkings : ${parkings.source}.`}
        </p>
      </div>

      {/* ── Ce qui concerne le quartier (alternative accessible à la carte) ── */}
      <section aria-labelledby="explore-title" className="card-joyful" style={{ padding: 20 }}>
        <h3 id="explore-title" style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 10 }}>Par quartier</h3>
        <label htmlFor="explore-quartier" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Quartier</label>
        <select
          id="explore-quartier" value={quartier} onChange={(e) => setQuartier(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e3dcce', fontSize: 15, marginBottom: 14 }}
        >
          {ZONE_QUARTIERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
        </select>

        {/* aria-live : le contenu change quand on choisit un quartier
            (y compris par un clic sur la carte) */}
        <div aria-live="polite">
          <ItemList
            title="Enquêtes ouvertes"
            items={items.surveys}
            empty="Aucune enquête ouverte pour ce quartier."
            href={(s) => `/enquetes/${s.slug}`}
          />
          <ItemList
            title="Propositions"
            items={items.proposals}
            empty="Aucune proposition pour ce quartier."
            href={(p) => `/propositions/${p.slug}`}
          />
          {unplaced.length > 0 && (
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
