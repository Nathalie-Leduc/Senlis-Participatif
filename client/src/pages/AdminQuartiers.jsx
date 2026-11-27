// ══════════════════════════════════════════════════════════
// Page Admin — tracer Saint-Vincent (S5R2-06) — /admin/quartiers
//
// Le plan municipal de 2018 coupe le « Centre Ville » de l'INSEE en
// deux : Centre historique (ex-« Centre-Sud ») et Quartier Saint-Vincent
// (ex-« Centre-Est – Saint-Vincent »). Le plan est un PDF sans
// coordonnées : on le pose sur la carte, et on repasse la limite au clic.
//
// Quatre étapes, dans l'ordre de l'écran :
//  1. (facultatif) poser l'image du plan en surimpression et la caler ;
//  2. tracer le contour de Saint-Vincent, point par point — on peut
//     déborder du centre : seul le centre INSEE est découpé ;
//  3. calculer et vérifier le découpage ;
//  4. télécharger le NOUVEAU fichier des quartiers, à placer dans le
//     dépôt (client/public/data/iris-senlis.geojson) puis à publier.
//
// Pourquoi un fichier à remplacer, plutôt qu'un enregistrement en base ?
// Les contours changent rarement (une fois, puis si le service SIG de la
// mairie fournit les officiels) : versionnés dans Git, ils restent
// relisibles, comparables, et reviennent en arrière d'une commande.
//
// L'image du plan n'est JAMAIS envoyée au serveur : elle reste dans le
// navigateur (URL locale « blob: »), le temps du tracé.
// ══════════════════════════════════════════════════════════

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { loadIris } from '../utils/irisData.js';
import { splitCentre, planarArea, centreGeometry } from '../utils/quartierSplit.js';
import { downloadText } from '../utils/download.js';

const QuartierDrawMap = lazy(() => import('../components/QuartierDrawMap/QuartierDrawMap.jsx'));

/** Emprise (sud-ouest, nord-est) de tous les contours, en [lat, lng] */
export function boundsOf(iris) {
  let south = 90; let west = 180; let north = -90; let east = -180;
  for (const f of iris?.features ?? []) {
    const polygons = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : (f.geometry?.coordinates ?? []);
    for (const ring of polygons.flat()) {
      for (const [lng, lat] of ring) {
        south = Math.min(south, lat); north = Math.max(north, lat);
        west = Math.min(west, lng); east = Math.max(east, lng);
      }
    }
  }
  return south <= north ? [[south, west], [north, east]] : null;
}

/**
 * Déplace ou étire l'image du plan. Chaque réglage est une petite
 * fraction (2 %) de sa taille actuelle : assez fin pour caler une rue
 * sur une rue, assez rapide pour un recalage grossier.
 * @param {[[number, number], [number, number]]} bounds - [[sud, ouest], [nord, est]]
 * @param {'up'|'down'|'left'|'right'|'bigger'|'smaller'|'wider'|'narrower'|'taller'|'shorter'} action
 */
export function adjustBounds([[south, west], [north, east]], action) {
  const height = north - south;
  const width = east - west;
  const dy = height * 0.02;
  const dx = width * 0.02;
  switch (action) {
    case 'up': return [[south + dy, west], [north + dy, east]];
    case 'down': return [[south - dy, west], [north - dy, east]];
    case 'left': return [[south, west - dx], [north, east - dx]];
    case 'right': return [[south, west + dx], [north, east + dx]];
    case 'bigger': return [[south - dy, west - dx], [north + dy, east + dx]];
    case 'smaller': return [[south + dy, west + dx], [north - dy, east - dx]];
    case 'wider': return [[south, west - dx], [north, east + dx]];
    case 'narrower': return [[south, west + dx], [north, east - dx]];
    case 'taller': return [[south - dy, west], [north + dy, east]];
    case 'shorter': return [[south + dy, west], [north - dy, east]];
    default: return [[south, west], [north, east]];
  }
}

const ADJUSTMENTS = [
  ['up', '↑ Monter'], ['down', '↓ Descendre'], ['left', '← Gauche'], ['right', '→ Droite'],
  ['bigger', '＋ Agrandir'], ['smaller', '－ Réduire'],
  ['wider', '↔ Élargir'], ['narrower', '→← Rétrécir'], ['taller', '↕ Allonger'], ['shorter', '↓↑ Raccourcir'],
];

export default function AdminQuartiers() {
  usePageTitle('Administration — Quartiers');
  const [iris, setIris] = useState(null);
  const [points, setPoints] = useState([]);
  const [overlay, setOverlay] = useState(null); // { url, bounds, opacity }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadIris().then((data) => { if (!cancelled) setIris(data); });
    return () => { cancelled = true; };
  }, []);

  // L'URL locale de l'image est libérée quand on la remplace ou qu'on quitte
  useEffect(() => () => { if (overlay?.url) URL.revokeObjectURL(overlay.url); }, [overlay?.url]);

  const alreadySplit = iris?.features?.some((f) => f.properties?.quartier === 'SAINT_VINCENT');

  // Toute modification du tracé efface le résultat : il ne correspondrait plus.
  // Mise à jour « à partir de la valeur précédente » (prev => …) : deux
  // clics très rapprochés (double-clic) ajoutent bien DEUX points — avec
  // [...points, point], le second partirait de l'ancienne liste.
  const changePoints = (update) => { setPoints(update); setResult(null); setError(null); };
  const addPoint = (point) => changePoints((prev) => [...prev, point]);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOverlay({ url: URL.createObjectURL(file), bounds: boundsOf(iris), opacity: 0.5 });
    e.target.value = '';
  };

  const compute = () => {
    try {
      setResult(splitCentre(iris, points));
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  };

  const download = () => {
    downloadText(JSON.stringify(result.file), 'iris-senlis.geojson', 'application/geo+json');
  };

  const centreArea = iris ? planarArea(centreGeometry(iris) ?? []) : 0;
  const svShare = result && centreArea ? planarArea(result.saintVincent.geometry.coordinates) / centreArea : 0;
  const percent = (x) => `${Math.round(x * 100)} %`;

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 960 }}>
      <Link to="/admin/propositions" style={{ color: '#6B6257', fontSize: 14 }}>← Retour à l'administration</Link>
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 8px' }}>
        Quartiers : séparer le Centre historique et Saint-Vincent
      </h1>
      <p style={{ color: '#6B6257', marginBottom: 8 }}>
        L'INSEE ne découpe pas le centre ; le plan municipal de 2018, si. Tracez le contour de
        <strong> Saint-Vincent</strong> : vous pouvez déborder du centre, seul le « Centre Ville » de l'INSEE
        (en doré) est découpé — les autres quartiers ne bougent pas.
      </p>
      {alreadySplit && (
        <p role="status" style={{ background: '#E3F0F6', borderRadius: 12, padding: '10px 14px', fontSize: 15 }}>
          Le fichier actuel contient déjà Saint-Vincent. Un nouveau tracé le remplacera.
        </p>
      )}

      {/* ── 1. Le plan en surimpression ── */}
      <section aria-labelledby="step-plan" style={{ margin: '20px 0' }}>
        <h2 id="step-plan" style={{ fontSize: 18, marginBottom: 6 }}>1. Poser le plan sur la carte (facultatif)</h2>
        <p style={{ fontSize: 14, color: '#6B6257', margin: '0 0 8px' }}>
          Une image (PNG ou JPG) du plan des quartiers. Elle reste sur votre ordinateur : rien n'est envoyé.
        </p>
        <label style={{ fontSize: 14, fontWeight: 600 }}>
          Image du plan{' '}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} disabled={!iris} />
        </label>
        {overlay && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              Transparence
              <input
                type="range" min="0.1" max="0.9" step="0.05" value={overlay.opacity}
                onChange={(e) => setOverlay({ ...overlay, opacity: Number(e.target.value) })}
              />
            </label>
            <div role="group" aria-label="Caler le plan sur la carte" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ADJUSTMENTS.map(([action, label]) => (
                <button
                  key={action} type="button" className="btn"
                  onClick={() => setOverlay({ ...overlay, bounds: adjustBounds(overlay.bounds, action) })}
                  style={{ background: '#EFEBE2', color: '#26333A', padding: '6px 12px', minHeight: 40, fontSize: 13 }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button" className="btn" onClick={() => setOverlay(null)}
                style={{ background: '#FCEAE6', color: '#A8442F', padding: '6px 12px', minHeight: 40, fontSize: 13 }}
              >
                Retirer le plan
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#6B6257', margin: 0 }}>
              Astuce : calez d'abord les grands axes visibles sur les deux, puis une rue du centre.
            </p>
          </div>
        )}
      </section>

      {/* ── 2. Le tracé ── */}
      <section aria-labelledby="step-draw" style={{ margin: '20px 0' }}>
        <h2 id="step-draw" style={{ fontSize: 18, marginBottom: 6 }}>2. Tracer Saint-Vincent</h2>
        <p style={{ fontSize: 14, color: '#6B6257', margin: '0 0 8px' }}>
          Cliquez sur la carte pour poser chaque sommet, dans l'ordre du contour. Au clavier : déplacez la carte
          avec les flèches, puis « Ajouter le point au centre » (le +).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <span aria-live="polite" style={{ fontWeight: 600, fontSize: 14 }}>
            {points.length} point{points.length > 1 ? 's' : ''}
          </span>
          <button
            type="button" className="btn" onClick={() => mapRef.current && addPoint([mapRef.current.getCenter().lat, mapRef.current.getCenter().lng])}
            style={{ background: '#E3EEF3', color: '#1E5F7C', padding: '6px 12px', minHeight: 40, fontSize: 13 }}
          >
            ＋ Ajouter le point au centre
          </button>
          <button
            type="button" className="btn" onClick={() => changePoints((prev) => prev.slice(0, -1))} disabled={!points.length}
            style={{ background: '#EFEBE2', color: '#26333A', padding: '6px 12px', minHeight: 40, fontSize: 13 }}
          >
            Annuler le dernier point
          </button>
          <button
            type="button" className="btn" onClick={() => changePoints([])} disabled={!points.length}
            style={{ background: '#FCEAE6', color: '#A8442F', padding: '6px 12px', minHeight: 40, fontSize: 13 }}
          >
            Tout effacer
          </button>
        </div>
        <Suspense fallback={<div style={{ height: 560, borderRadius: 16, background: '#E3EEF3' }}>Chargement de la carte…</div>}>
          <QuartierDrawMap
            iris={iris} points={points} onAddPoint={addPoint} mapRef={mapRef}
            overlay={overlay} preview={result && { centre: result.centre, saintVincent: result.saintVincent }}
          />
        </Suspense>
      </section>

      {/* ── 3. Vérifier ── */}
      <section aria-labelledby="step-check" style={{ margin: '20px 0' }}>
        <h2 id="step-check" style={{ fontSize: 18, marginBottom: 6 }}>3. Calculer et vérifier</h2>
        <button type="button" className="btn btn-primary" onClick={compute} disabled={!iris || points.length < 3}>
          Calculer le découpage
        </button>
        {error && <p role="alert" style={{ color: '#A8442F', fontWeight: 600, marginTop: 10 }}>{error}</p>}
        {result && (
          <div role="status" style={{ marginTop: 10, fontSize: 15 }}>
            <p style={{ margin: '0 0 4px' }}>
              Sur la carte : <strong style={{ color: '#B8862F' }}>Centre historique</strong> en doré,{' '}
              <strong style={{ color: '#1E5F7C' }}>Quartier Saint-Vincent</strong> en bleu.
              Saint-Vincent représente {percent(svShare)} de l'ancien « Centre Ville ».
            </p>
            {result.outsideShare > 0.005 && (
              <p style={{ margin: 0, color: '#6B6257' }}>
                {percent(result.outsideShare)} de votre tracé est hors du centre de l'INSEE : cette partie reste dans
                son quartier actuel (décision du 12/10).
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── 4. Enregistrer ── */}
      <section aria-labelledby="step-save" style={{ margin: '20px 0' }}>
        <h2 id="step-save" style={{ fontSize: 18, marginBottom: 6 }}>4. Enregistrer</h2>
        <button type="button" className="btn btn-primary" onClick={download} disabled={!result}>
          Télécharger le fichier des quartiers
        </button>
        <p style={{ fontSize: 14, color: '#6B6257', marginTop: 8 }}>
          Le fichier <code>iris-senlis.geojson</code> remplace celui du dépôt, dans <code>client/public/data/</code> ;
          il est en ligne à la prochaine publication du site.
        </p>
      </section>
    </div>
  );
}
