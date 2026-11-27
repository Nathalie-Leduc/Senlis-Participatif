// ══════════════════════════════════════════════════════════
// Carte de l'écran « Parkings » (S5R2-05, plusieurs emplacements et
// traits depuis la recette du 20/10)
//
// Montre tous les parkings déjà placés (mêmes repères et traits que la
// carte publique). Quand un parking est en cours de modification :
//  - en mode « points », chaque clic AJOUTE un emplacement ;
//  - en mode « trait », chaque clic ajoute un sommet au trait en cours
//    (pointillés), jusqu'à « Terminer le trait » ;
//  - ses emplacements sont entourés de doré, pour les repérer.
// Un clic sur le repère d'un autre parking l'ouvre en modification.
//
// Analogie : un plan papier, des gommettes (points) et un surligneur
// (traits le long des rues).
// ══════════════════════════════════════════════════════════

import { Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, CircleMarker, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { parkingIcon } from '../MapView/MapView.jsx';
import { regimeMeta } from '../../constants/parkings.js';
import { parkingShapes, toLatLng } from '../../utils/parkings.js';

const SENLIS_CENTRE = [49.2066, 2.5866];
const GOLD = '#D4A84A';

/** Un clic sur la carte → { lat, lng } */
function ClickToPlace({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/**
 * @param {object} props
 * @param {Array<object>} props.parkings - tous les parkings (les non placés sont ignorés)
 * @param {{ id?: string, name: string, regime?: string, charging?: string,
 *   locations: Array<object>, draft: Array<[number, number]> } | null} props.editing
 *   le parking en cours : ses emplacements (GeoJSON, pas encore enregistrés)
 *   et le trait en cours de tracé (draft, positions GeoJSON)
 * @param {(point: { lat: number, lng: number }) => void} [props.onMapClick] - absent : lecture seule
 * @param {(parking: object) => void} [props.onSelect]
 */
export default function ParkingPlaceMap({ parkings, editing, onMapClick, onSelect }) {
  // Les autres parkings, tels que sur la carte publique
  const others = parkingShapes(parkings.filter((p) => p.id !== editing?.id));
  const byId = new Map(parkings.map((p) => [p.id, p]));
  const color = regimeMeta(editing?.regime).bg;

  return (
    <MapContainer
      center={SENLIS_CENTRE} zoom={16} scrollWheelZoom doubleClickZoom={false}
      style={{ height: 520, borderRadius: 16, cursor: editing && onMapClick ? 'crosshair' : 'grab' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {editing && onMapClick && <ClickToPlace onMapClick={onMapClick} />}

      {others.lines.map((line) => (
        <Polyline
          key={line.id} positions={line.positions}
          pathOptions={{ color: regimeMeta(line.regime).bg, weight: 5, opacity: 0.8 }}
          eventHandlers={{ click: () => onSelect?.(byId.get(line.parkingId)) }}
        >
          <Tooltip>{line.label}</Tooltip>
        </Polyline>
      ))}
      {others.points.map((p) => (
        <Marker
          key={p.id} position={[p.lat, p.lng]} icon={parkingIcon(p.regime, p.charging)}
          eventHandlers={{ click: () => onSelect?.(byId.get(p.parkingId)) }}
        >
          <Tooltip>{p.label}</Tooltip>
        </Marker>
      ))}

      {/* Le parking en cours de modification, entouré de doré */}
      {editing?.locations.map((g, i) => (g.type === 'Point' ? (
        <Fragment key={`edit-${i}`}>
          <CircleMarker center={toLatLng(g.coordinates)} radius={22} pathOptions={{ color: GOLD, weight: 4, fillOpacity: 0 }} interactive={false} />
          <Marker position={toLatLng(g.coordinates)} icon={parkingIcon(editing.regime, editing.charging)}>
            <Tooltip direction="top" offset={[0, -16]}>{`${editing.name || 'Nouveau parking'} — point ${i + 1}`}</Tooltip>
          </Marker>
        </Fragment>
      ) : (
        <Fragment key={`edit-${i}`}>
          <Polyline positions={g.coordinates.map(toLatLng)} pathOptions={{ color: GOLD, weight: 11, opacity: 0.7 }} interactive={false} />
          <Polyline positions={g.coordinates.map(toLatLng)} pathOptions={{ color, weight: 5 }}>
            <Tooltip sticky>{`${editing.name || 'Nouveau parking'} — trait ${i + 1}`}</Tooltip>
          </Polyline>
        </Fragment>
      )))}

      {/* Le trait en cours de tracé : pointillés et sommets */}
      {editing?.draft?.length > 0 && (
        <>
          <Polyline positions={editing.draft.map(toLatLng)} pathOptions={{ color, weight: 4, dashArray: '8 6' }} interactive={false} />
          {editing.draft.map((position, i) => (
            <CircleMarker key={`draft-${i}`} center={toLatLng(position)} radius={5} pathOptions={{ color: '#26333A', weight: 2, fillColor: '#FFFFFF', fillOpacity: 1 }} interactive={false} />
          ))}
        </>
      )}
    </MapContainer>
  );
}
