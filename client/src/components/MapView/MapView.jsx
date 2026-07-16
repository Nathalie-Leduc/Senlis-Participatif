// ══════════════════════════════════════════════════════════
// MapView — composant carte Leaflet, cœur du Sprint 3
//
// Ce fichier importe react-leaflet, leaflet et sa feuille de
// style — des bibliothèques assez lourdes à elles trois. Il
// n'est JAMAIS importé directement par une page : c'est
// LazyMapView.jsx qui le charge à la demande (import dynamique),
// pour que ce poids ne s'ajoute au bundle principal QUE sur les
// pages qui affichent effectivement une carte.
//
// Analogie : plutôt que de faire porter à CHAQUE visiteur du
// site le sac à dos contenant la carte — même s'il ne la
// consulte jamais — on ne le sort du placard que pour ceux qui
// ouvrent une page où une carte apparaît réellement.
// ══════════════════════════════════════════════════════════

import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';

// Icône personnalisée — un pin rond aux couleurs de la charte
// graphique, avec le cerf en filigrane.
//
// Pourquoi pas les icônes PNG par défaut de Leaflet ? Leur chemin
// d'image se casse presque toujours avec un bundler comme Vite —
// c'est un problème connu et documenté de react-leaflet (les URLs
// des images sont calculées pour un site classique, pas pour un
// build Vite). Un DivIcon en HTML/CSS pur ne dépend d'aucun
// fichier externe à résoudre : zéro risque de ce bug-là.
const cerfIcon = L.divIcon({
  className: '', // sans ça, Leaflet ajoute ses propres styles par défaut (fond blanc carré)
  html: `<div style="
    width: 34px; height: 34px; border-radius: 50% 50% 50% 0;
    background: #1E5F7C; transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 3px 8px rgba(0,0,0,.3);
  "><span style="transform: rotate(45deg); font-size: 16px;">🦌</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34], // la pointe du pin = la position exacte du lieu
});

// Centre par défaut : le centre historique de Senlis — utile
// quand aucun marqueur précis n'est fourni (vue d'ensemble).
const SENLIS_CENTER = [49.2058, 2.5847];

// Style du tracé de périmètre (zone piétonne, par exemple) — vert
// "tilleul" semi-transparent, cohérent avec la légende prévue au
// wireframe (🟢 Périmètre piéton).
const PERIMETER_STYLE = {
  color: '#3A7A4D',
  weight: 3,
  fillColor: '#3A7A4D',
  fillOpacity: 0.15,
};

// Style de la couche IRIS — chaque quartier en gris discret, SAUF
// "Centre Ville" mis en évidence en doré : c'est précisément ce que
// demande le cahier des charges ("permettant d'isoler le centre
// historique"), pas juste afficher les 7 quartiers au même niveau.
function irisStyle(feature) {
  const isCentreVille = feature.properties?.nom_iris === 'Centre Ville';
  return isCentreVille
    ? { color: '#D4A84A', weight: 2, fillColor: '#D4A84A', fillOpacity: 0.25 }
    : { color: '#948B7D', weight: 1, fillColor: '#948B7D', fillOpacity: 0.06 };
}

// Icône parking — même principe que cerfIcon (DivIcon en CSS pur,
// pas d'image externe à résoudre), mais couleur et symbole distincts
// pour qu'on ne confonde jamais un parking avec une proposition.
const parkingIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 30px; height: 30px; border-radius: 6px;
    background: #1E5F7C; display: flex; align-items: center;
    justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.3);
    color: #fff; font-weight: 700; font-size: 14px;
  ">P</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/**
 * @param {[number, number]} center - [latitude, longitude] du centre initial
 * @param {number} zoom - niveau de zoom initial (plus grand = plus proche)
 * @param {Array<{id, lat, lng, label, slug?}>} markers - points à afficher
 * @param {object|Array<object>} perimeters - un objet GeoJSON (Feature/FeatureCollection),
 *   ou un tableau de plusieurs — le tracé d'une zone piétonne, par exemple.
 *   Peut être absent : toutes les propositions n'ont pas forcément
 *   de périmètre saisi (ça arrive avec S3-04, saisie admin).
 * @param {object} iris - FeatureCollection GeoJSON des 7 quartiers IRIS de
 *   Senlis (INSEE/IGN) — absent = couche non affichée.
 * @param {Array<{id, lat, lng, label}>} parkings - parkings de report (exemple)
 * @param {number|string} height - hauteur du conteneur (la largeur suit son parent)
 */
export default function MapView({
  center = SENLIS_CENTER,
  zoom = 15,
  markers = [],
  perimeters = [],
  iris = null,
  parkings = [],
  height = 320,
}) {
  // On accepte un objet GeoJSON unique OU un tableau — plus simple
  // pour qui appelle ce composant avec une seule proposition (page
  // détail) que d'avoir à l'envelopper soi-même dans un tableau.
  const perimeterList = Array.isArray(perimeters) ? perimeters : [perimeters];

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%', borderRadius: 20 }}
      // Sans ça, faire défiler la PAGE avec la molette "piège" le
      // scroll dans la carte dès que la souris passe dessus — une
      // frustration classique des cartes embarquées. L'utilisateur
      // doit cliquer une fois sur la carte pour activer le zoom
      // molette, volontairement.
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* La couche IRIS est rendue AVANT le périmètre et les
          marqueurs, pour rester "sous" eux visuellement — un
          quartier grisé en fond, pas par-dessus une proposition. */}
      {iris && (
        <GeoJSON
          data={iris}
          style={irisStyle}
          // Chaque quartier affiche son nom au clic — sans ça, un
          // visiteur ne saurait pas ce que représentent ces zones.
          onEachFeature={(feature, layer) => {
            if (feature.properties?.nom_iris) {
              layer.bindPopup(`<strong>${feature.properties.nom_iris}</strong>`);
            }
          }}
        />
      )}

      {parkings.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={parkingIcon}>
          <Popup><strong>🅿️ {p.label}</strong></Popup>
        </Marker>
      ))}

      {perimeterList.filter(Boolean).map((geoJson, i) => (
        <GeoJSON key={i} data={geoJson} style={PERIMETER_STYLE} />
      ))}

      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={cerfIcon}>
          <Popup>
            <strong>{m.label}</strong>
            {m.slug && (
              <>
                <br />
                <Link to={`/propositions/${m.slug}`}>Voir la proposition</Link>
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
