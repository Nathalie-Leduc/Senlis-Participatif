// ══════════════════════════════════════════════════════════
// Carte de l'écran « Parkings » (S5R2-05)
//
// Montre tous les parkings déjà placés (mêmes repères que la carte
// publique). Quand un parking est en cours de modification :
//  - un clic sur la carte le place (ou le déplace) à cet endroit ;
//  - son repère est entouré d'un cercle doré, pour le repérer.
// Un clic sur le repère d'un autre parking l'ouvre en modification.
//
// Analogie : un tableau de liège et des punaises — on prend une
// punaise (le parking choisi dans la liste) et on la plante d'un geste.
// ══════════════════════════════════════════════════════════

import { MapContainer, TileLayer, Marker, Tooltip, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { parkingIcon } from '../MapView/MapView.jsx';

const SENLIS_CENTRE = [49.2066, 2.5866];

/** Un clic sur la carte → coordonnées arrondies à 6 décimales (≈ 10 cm) */
function ClickToPlace({ onPlace }) {
  useMapEvents({
    click: (e) => onPlace?.({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 }),
  });
  return null;
}

/**
 * @param {object} props
 * @param {Array<object>} props.parkings - tous les parkings (les non placés sont ignorés)
 * @param {{ id?: string, lat: number|null, lng: number|null, regime?: string, charging?: string } | null} props.editing
 *   le parking en cours de modification (position du formulaire, pas encore enregistrée)
 * @param {(point: { lat: number, lng: number }) => void} [props.onPlace] - absent : lecture seule
 * @param {(parking: object) => void} [props.onSelect]
 */
export default function ParkingPlaceMap({ parkings, editing, onPlace, onSelect }) {
  const placed = parkings.filter((p) => p.lat !== null && p.lng !== null && p.id !== editing?.id);
  const editingPlaced = editing && editing.lat !== null && editing.lng !== null;

  return (
    <MapContainer
      center={SENLIS_CENTRE} zoom={16} scrollWheelZoom
      style={{ height: 520, borderRadius: 16, cursor: editing && onPlace ? 'crosshair' : 'grab' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {editing && onPlace && <ClickToPlace onPlace={onPlace} />}

      {placed.map((p) => (
        <Marker
          key={p.id} position={[p.lat, p.lng]} icon={parkingIcon(p.regime, p.charging)}
          eventHandlers={{ click: () => onSelect?.(p) }}
        >
          <Tooltip>{p.name}</Tooltip>
        </Marker>
      ))}

      {editingPlaced && (
        <>
          <CircleMarker center={[editing.lat, editing.lng]} radius={22} pathOptions={{ color: '#D4A84A', weight: 4, fillOpacity: 0 }} interactive={false} />
          <Marker position={[editing.lat, editing.lng]} icon={parkingIcon(editing.regime, editing.charging)}>
            <Tooltip permanent direction="top" offset={[0, -16]}>{editing.name || 'Nouveau parking'}</Tooltip>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
