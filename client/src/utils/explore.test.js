import { describe, it, expect } from 'vitest';
import { surveyPlaces, itemsForQuartier, unplacedProposals } from './explore.js';

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
