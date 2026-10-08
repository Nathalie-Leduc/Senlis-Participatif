import { describe, it, expect } from 'vitest';
import { surveyPlaces, itemsForQuartier, unplacedProposals, itemsForSelection, irisCentroids, mapMarkers } from './explore.js';

const EMPTY = { situations: [], quartiers: [], workQuartiers: [], workTypes: [] };
const survey = (audience, extra = {}) => ({ id: Math.random().toString(), title: 's', audience: { ...EMPTY, ...audience }, ...extra });

describe('rattacher une enquête à des quartiers (via son public visé)', () => {
  it('tout le monde, visiteurs hors Senlis, ou rôle sans quartier → toute la ville', () => {
    expect(surveyPlaces(survey({})).wholeCity).toBe(true);
    expect(surveyPlaces(survey({ situations: ['HORS_SENLIS'] })).wholeCity).toBe(true);
    expect(surveyPlaces(survey({ workTypes: ['SALARIE'] })).wholeCity).toBe(true);
  });

  it('habitants du centre, autres quartiers (précis ou tous), quartiers de travail', () => {
    expect(surveyPlaces(survey({ situations: ['CENTRE_RESIDENT'] }))).toEqual({ wholeCity: false, quartiers: ['CENTRE_HISTORIQUE'] });
    expect(surveyPlaces(survey({ situations: ['AUTRE_QUARTIER'], quartiers: ['VILLEVERT'] })).quartiers).toEqual(['VILLEVERT']);
    expect(surveyPlaces(survey({ situations: ['AUTRE_QUARTIER'] })).quartiers).toHaveLength(6); // tous sauf le centre
    expect(surveyPlaces(survey({ workQuartiers: ['BRICHEBAY'], workTypes: ['COMMERCANT'] })).quartiers).toEqual(['BRICHEBAY']);
  });
});

describe('ce qui concerne un quartier', () => {
  const proposals = [
    { id: 'p1', title: 'Centre', zoneQuartiers: ['CENTRE_HISTORIQUE'] },
    { id: 'p2', title: 'Ville', zoneWholeCity: true, zoneQuartiers: [] },
    { id: 'p3', title: 'Nulle part', zoneQuartiers: [] },
  ];
  const surveys = [survey({ situations: ['CENTRE_RESIDENT'] }, { id: 's1' }), survey({}, { id: 's2' })];

  it('les éléments du quartier ET ceux de toute la ville (signalés)', () => {
    const centre = itemsForQuartier('CENTRE_HISTORIQUE', proposals, surveys);
    expect(centre.proposals.map((p) => [p.id, p.wholeCity])).toEqual([['p1', false], ['p2', true]]);
    expect(centre.surveys.map((s) => s.id)).toEqual(['s1', 's2']);

    const villevert = itemsForQuartier('VILLEVERT', proposals, surveys);
    expect(villevert.proposals.map((p) => p.id)).toEqual(['p2']);
    expect(villevert.surveys.map((s) => s.id)).toEqual(['s2']);
  });

  it('les propositions sans zone sont comptées à part', () => {
    expect(unplacedProposals(proposals).map((p) => p.id)).toEqual(['p3']);
  });
});

describe('v2 : toute la ville par défaut, un ou plusieurs quartiers', () => {
  const proposals = [
    { id: 'p1', slug: 'a', title: 'Centre', zoneQuartiers: ['CENTRE_HISTORIQUE'] },
    { id: 'p2', slug: 'b', title: 'Brichebay', zoneQuartiers: ['BRICHEBAY'], lat: 49.21, lng: 2.6 },
    { id: 'p3', slug: 'c', title: 'Ville', zoneWholeCity: true, zoneQuartiers: [] },
  ];
  const surveys = [survey({ situations: ['CENTRE_RESIDENT'] }, { id: 's1', slug: 's1', title: 'Enquête centre' })];

  it('rien de coché = TOUT ; plusieurs quartiers = leur réunion (+ toute la ville)', () => {
    expect(itemsForSelection([], proposals, surveys).proposals).toHaveLength(3);
    const two = itemsForSelection(['BRICHEBAY', 'VILLEVERT'], proposals, surveys);
    expect(two.proposals.map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(two.surveys).toHaveLength(0);
  });

  it('centre d’un quartier = moyenne des sommets de son contour', () => {
    const iris = { features: [{ properties: { code_iris: 'X' }, geometry: { type: 'Polygon', coordinates: [[[2, 49], [4, 49], [4, 51], [2, 51]]] } }] };
    expect(irisCentroids(iris).get('X')).toEqual([50, 3]);
  });

  it('repères : point précis, sinon centre du quartier, sinon centre-ville ; enquêtes comprises', () => {
    const centroids = new Map([['C', [49.2, 2.58]]]);
    const codeOf = (q) => (q === 'CENTRE_HISTORIQUE' ? 'C' : null);
    const markers = mapMarkers({ proposals, surveys, centroids, codeOf, selected: [], cityCenter: [49.2058, 2.5847] });

    const byId = Object.fromEntries(markers.map((m) => [m.id, m]));
    expect(byId['proposal-p2']).toMatchObject({ lat: 49.21, lng: 2.6, href: '/propositions/b' });
    expect(byId['proposal-p3-ville'].label).toMatch(/toute la ville/);
    expect(byId['survey-s1-CENTRE_HISTORIQUE']).toMatchObject({ kind: 'survey', href: '/enquetes/s1' });
    // Deux repères au centre du quartier C : écartés pour rester cliquables
    const atCentre = markers.filter((m) => m.id.endsWith('CENTRE_HISTORIQUE'));
    expect(atCentre).toHaveLength(2);
    expect(atCentre[0].lat === atCentre[1].lat && atCentre[0].lng === atCentre[1].lng).toBe(false);
  });
});
