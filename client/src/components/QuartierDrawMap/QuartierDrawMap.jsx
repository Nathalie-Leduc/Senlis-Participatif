// ══════════════════════════════════════════════════════════
// Carte de l'outil de tracé des quartiers (S5R2-06)
//
// Une carte Leaflet dédiée, plus simple que MapView : elle sait
//  - afficher les quartiers actuels (le centre INSEE en doré) ;
//  - poser, en surimpression réglable, une IMAGE du plan municipal ;
//  - ajouter un sommet du tracé à chaque clic ;
//  - montrer le résultat du découpage avant de l'enregistrer.
//
// Analogie : une table lumineuse de dessinateur — le fond de carte en
// dessous, le plan sur calque par-dessus, et on repasse au crayon.
// ══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CENTRE_IRIS } from '../../utils/quartierSplit.js';
import { contentKey } from '../MapView/MapView.jsx';

const CENTRE_VIEW = [49.2058, 2.5935];

/** Ajoute un sommet à chaque clic sur la carte */
function ClickToAdd({ onAddPoint }) {
  useMapEvents({ click: (e) => onAddPoint([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** Donne au parent un accès à la carte (pour « ajouter le point au centre ») */
function ExposeMap({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

const irisStyle = (feature) => (feature.properties?.code_iris === CENTRE_IRIS
  ? { color: '#B8862F', weight: 2, fillColor: '#D4A84A', fillOpacity: 0.15, interactive: false }
  : { color: '#948B7D', weight: 1, fillColor: '#948B7D', fillOpacity: 0.04, interactive: false });

/**
 * @param {object} props
 * @param {object|null} props.iris - fichier des quartiers actuel
 * @param {Array<[number, number]>} props.points - sommets du tracé [lat, lng]
 * @param {(point: [number, number]) => void} props.onAddPoint
 * @param {{ centre: object, saintVincent: object } | null} props.preview - résultat du découpage
 * @param {{ url: string, bounds: [[number, number], [number, number]], opacity: number } | null} props.overlay
 * @param {{ current: object|null }} props.mapRef
 */
export default function QuartierDrawMap({ iris, points, onAddPoint, preview, overlay, mapRef }) {
  return (
    <div style={{ position: 'relative' }}>
      <MapContainer
        center={CENTRE_VIEW} zoom={15} scrollWheelZoom
        style={{ height: 560, borderRadius: 16, cursor: 'crosshair' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ExposeMap mapRef={mapRef} />
        <ClickToAdd onAddPoint={onAddPoint} />

        {iris && !preview && <GeoJSON key={contentKey(iris)} data={iris} style={irisStyle} />}

        {overlay && (
          <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={overlay.opacity} interactive={false} />
        )}

        {/* Résultat : Centre historique doré, Saint-Vincent bleu (couleurs de
            l'outil seulement — sur le site, Saint-Vincent reste gris) */}
        {preview && (
          <>
            <GeoJSON key={`ch-${contentKey(preview.centre)}`} data={preview.centre} style={{ color: '#B8862F', weight: 2, fillColor: '#D4A84A', fillOpacity: 0.35, interactive: false }} />
            <GeoJSON key={`sv-${contentKey(preview.saintVincent)}`} data={preview.saintVincent} style={{ color: '#1E5F7C', weight: 2, fillColor: '#1E5F7C', fillOpacity: 0.35, interactive: false }} />
          </>
        )}

        {/* Le tracé en cours : trait, puis forme fermée dès 3 points */}
        {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#A8442F', weight: 2, dashArray: '6 4', fillOpacity: 0.08 }} interactive={false} />}
        {points.length === 2 && <Polyline positions={points} pathOptions={{ color: '#A8442F', weight: 2 }} interactive={false} />}
        {points.map((p, i) => (
          // key = rang : un sommet n'a pas d'autre identité que sa place dans le tracé
          <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: '#A8442F', fillColor: '#fff', fillOpacity: 1, weight: 2 }} interactive={false} />
        ))}
      </MapContainer>
      {/* Viseur au centre : pour « Ajouter un point au centre de la carte »
          (alternative au clic, utilisable au clavier — flèches pour déplacer) */}
      <span aria-hidden="true" style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 500, pointerEvents: 'none', fontSize: 22, color: '#A8442F', lineHeight: 1,
      }}
      >+</span>
    </div>
  );
}
