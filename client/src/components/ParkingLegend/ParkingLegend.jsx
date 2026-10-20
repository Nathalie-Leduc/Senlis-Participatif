// ══════════════════════════════════════════════════════════
// Légende des parkings et des tarifs 2025 (S5R2-05)
//
// Sous la carte, quand la couche « Parkings » est affichée : ce que
// veut dire chaque repère (lettre + couleur, comme sur le plan de la
// Ville), puis les règles et tarifs du guide de janvier 2025, avec la
// mention « tarifs indicatifs » — seuls les tarifs affichés sur place
// font foi.
//
// <details> : repliée par défaut pour les tarifs (longs), ouverte d'un
// clic ou au clavier, sans JavaScript.
// ══════════════════════════════════════════════════════════

import { PARKING_REGIMES, PARKINGS_SOURCE, TARIFS_2025 } from '../../constants/parkings.js';

/** Le repère tel qu'il apparaît sur la carte (décoratif : le texte suit) */
function Marker({ regime }) {
  const { letter, bg, fg } = PARKING_REGIMES[regime];
  return (
    <span aria-hidden="true" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      width: 22, height: 22, borderRadius: 5, background: bg, color: fg, fontWeight: 700, fontSize: 12,
    }}>
      {letter}
    </span>
  );
}

export default function ParkingLegend() {
  return (
    <section aria-labelledby="parking-legend-title" style={{ marginTop: 12, fontSize: 14 }}>
      <h3 id="parking-legend-title" style={{ fontSize: 15, margin: '0 0 8px' }}>Légende des parkings</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 6 }}>
        {Object.keys(PARKING_REGIMES).map((regime) => (
          <li key={regime} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Marker regime={regime} />{PARKING_REGIMES[regime].label}
          </li>
        ))}
        <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" style={{ width: 22, textAlign: 'center' }}>⚡</span>
          Borne de recharge (bleue : installée, violette : en projet)
        </li>
      </ul>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Règles et tarifs du stationnement (2025)</summary>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0 }}>{TARIFS_2025.horaires}</p>
          <p style={{ margin: 0 }}><strong>Gratuité :</strong> {TARIFS_2025.gratuite}</p>
          {TARIFS_2025.zones.map((zone) => (
            <p key={zone.regime} style={{ margin: 0, display: 'flex', gap: 8 }}>
              <Marker regime={zone.regime} />
              <span><strong>{zone.title}</strong> ({zone.places}) — {zone.exemples}</span>
            </p>
          ))}
          <p style={{ margin: 0 }}>{TARIFS_2025.fps}</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {TARIFS_2025.abonnements.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p style={{ margin: 0 }}><strong>Personnes à mobilité réduite :</strong> {TARIFS_2025.pmr}</p>
          <p style={{ margin: 0 }}>{TARIFS_2025.gratuits}</p>
        </div>
      </details>

      <p style={{ fontSize: 12, color: '#6B6257', marginTop: 8 }}>
        {TARIFS_2025.mention} Source : {PARKINGS_SOURCE}.
      </p>
    </section>
  );
}
