// ══════════════════════════════════════════════════════════
// Découpage du « Centre Ville » INSEE en deux quartiers (S5R2-06)
//
// L'INSEE ne découpe pas le centre ; le plan municipal de 2018, si :
// « Centre-Sud » (→ Centre historique) et « Centre-Est – Saint-Vincent »
// (→ Quartier Saint-Vincent). L'administratrice trace Saint-Vincent sur
// la carte (outil /admin/quartiers) ; ce module fait le reste :
//
//   Saint-Vincent     = Centre Ville INSEE ∩ tracé
//   Centre historique = Centre Ville INSEE − tracé
//
// Décision du 12/10 : on COUPE au contour du centre. La partie du tracé
// qui déborde (le plan de 2018 étend Saint-Vincent vers l'est, sur la
// Zone industrielle et Jardiniers de l'INSEE) est ignorée — les autres
// quartiers ne bougent pas, et aucun quartier n'en chevauche un autre.
//
// Analogie : découper une part de gâteau à l'emporte-pièce. On peut
// poser l'emporte-pièce à cheval sur le bord du plat : seul le gâteau
// est découpé, jamais le plat.
//
// Les opérations sur les formes (intersection, différence) viennent de
// polygon-clipping (MIT) : un calcul géométrique exact est un problème
// difficile (bords communs, points alignés…), qu'on ne réécrit pas.
// ══════════════════════════════════════════════════════════

import polygonClipping from 'polygon-clipping';
import { quartierOfFeature } from '../constants/zones.js';

/** Code IRIS du « Centre Ville » de l'INSEE, partagé par les deux quartiers */
export const CENTRE_IRIS = '606120101';

/** Coordonnées arrondies comme dans le fichier INSEE (8 décimales ≈ 1 mm) */
const round = (n) => Math.round(n * 1e8) / 1e8;
const roundGeometry = (multiPolygon) => multiPolygon.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [round(x), round(y)])));

/** Une géométrie GeoJSON → liste de polygones (format polygon-clipping) */
function asMultiPolygon(geometry) {
  if (!geometry) return [];
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/**
 * Surface « à plat » d'une forme, en degrés² corrigés de la latitude.
 * Ne sert qu'à comparer des surfaces entre elles (un pourcentage) :
 * l'unité importe peu, la proportion est juste à cette échelle.
 */
export function planarArea(multiPolygon) {
  const ringArea = (ring) => {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      sum += x1 * y2 - x2 * y1; // formule du lacet (shoelace)
    }
    return Math.abs(sum) / 2;
  };
  const lat = multiPolygon[0]?.[0]?.[0]?.[1] ?? 49;
  const k = Math.cos((lat * Math.PI) / 180); // 1° de longitude est plus court qu'1° de latitude
  return multiPolygon.reduce((total, polygon) => {
    const [outer, ...holes] = polygon;
    return total + (ringArea(outer) - holes.reduce((h, ring) => h + ringArea(ring), 0)) * k;
  }, 0);
}

/**
 * Le contour complet du « Centre Ville » INSEE, même si le fichier est
 * DÉJÀ découpé (on peut retracer : on recolle d'abord les deux moitiés).
 */
export function centreGeometry(iris) {
  const parts = (iris?.features ?? []).filter((f) => f.properties?.code_iris === CENTRE_IRIS);
  if (!parts.length) return null;
  return polygonClipping.union(...parts.map((f) => asMultiPolygon(f.geometry)));
}

/**
 * Découpe le centre selon le tracé de Saint-Vincent.
 *
 * @param {object} iris - le fichier des quartiers (FeatureCollection)
 * @param {Array<[number, number]>} points - sommets du tracé, en [lat, lng]
 *   (l'ordre de Leaflet), au moins 3, sans répéter le premier à la fin
 * @param {Date} [date] - date du tracé, notée dans le fichier
 * @returns {{ file: object, saintVincent: object, centre: object, outsideShare: number }}
 *   file : le NOUVEAU fichier des quartiers (8 contours) ;
 *   outsideShare : part du tracé hors du centre INSEE (0 à 1), ignorée
 * @throws {Error} tracé trop court, ou qui ne coupe pas le centre en deux
 */
export function splitCentre(iris, points, date = new Date()) {
  if (!points || points.length < 3) throw new Error('Tracez au moins 3 points autour de Saint-Vincent.');
  const centre = centreGeometry(iris);
  if (!centre) throw new Error('Le contour du « Centre Ville » INSEE est introuvable dans le fichier des quartiers.');

  // Leaflet donne [lat, lng] ; GeoJSON veut [lng, lat], anneau FERMÉ
  const ring = points.map(([lat, lng]) => [lng, lat]);
  const drawn = [[[...ring, ring[0]]]];

  const saintVincent = polygonClipping.intersection(centre, drawn);
  const historique = polygonClipping.difference(centre, drawn);
  if (!saintVincent.length) throw new Error('Le tracé ne touche pas le centre : Saint-Vincent serait vide.');
  if (!historique.length) throw new Error('Le tracé couvre tout le centre : il ne resterait rien au Centre historique.');

  const drawnArea = planarArea(drawn);
  const outside = polygonClipping.difference(drawn, centre);
  const outsideShare = drawnArea > 0 ? planarArea(outside) / drawnArea : 0;

  const source = `IRIS INSEE « Centre Ville » découpé d'après le plan municipal de 2018 (tracé du ${date.toLocaleDateString('fr-FR')})`;
  const feature = (quartier, nom, geometry) => ({
    type: 'Feature',
    properties: { code_iris: CENTRE_IRIS, nom_iris: 'Centre Ville', quartier, nom, source },
    geometry: { type: 'MultiPolygon', coordinates: roundGeometry(geometry) },
  });
  const centreFeature = feature('CENTRE_HISTORIQUE', 'Centre historique', historique);
  const saintVincentFeature = feature('SAINT_VINCENT', 'Quartier Saint-Vincent', saintVincent);

  // Les autres quartiers : INCHANGÉS, avec leur quartier écrit en clair
  const others = iris.features
    .filter((f) => f.properties?.code_iris !== CENTRE_IRIS)
    .map((f) => ({ ...f, properties: { ...f.properties, quartier: quartierOfFeature(f) } }));

  return {
    file: { ...iris, features: [...others, centreFeature, saintVincentFeature] },
    centre: centreFeature,
    saintVincent: saintVincentFeature,
    outsideShare,
  };
}
