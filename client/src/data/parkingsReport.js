// ══════════════════════════════════════════════════════════
// Parkings de report — DONNÉES D'EXEMPLE
//
// ⚠️ Contrairement à la couche IRIS (données INSEE/IGN réelles),
// ceci n'est PAS un jeu de données public : c'est un exemple de
// démonstration, illustrant le concept "parkings de report" décrit
// dans la proposition de piétonnisation. Les emplacements réels
// seront décidés par la mairie si cette proposition avance —
// on ne prétend jamais que ces points sont un vrai plan municipal.
//
// Analogie : comme le seed.js qui crée des propositions de
// démonstration pour tester l'app, ces parkings ne sont là que
// pour vérifier que l'affichage fonctionne — pas pour informer
// un vrai automobiliste sur où se garer samedi prochain.
// ══════════════════════════════════════════════════════════

export const PARKINGS_REPORT_EXEMPLE = [
  { id: 'p1', lat: 49.2095, lng: 2.5810, label: 'Parking de report — Gare (exemple)' },
  { id: 'p2', lat: 49.2020, lng: 2.5920, label: 'Parking de report — Stade (exemple)' },
  { id: 'p3', lat: 49.2140, lng: 2.5790, label: 'Parking de report — Nord (exemple)' },
];
