// ══════════════════════════════════════════════════════════
// ProposalCard — une carte de proposition dans la liste
//
// Affiche : titre, résumé, badge de statut, jauge de vote
// tricolore (POUR/NEUTRE/CONTRE), et les comptages.
//
// La jauge s'anime QUAND la carte devient visible à l'écran
// (pas au chargement de la page) — useScrollReveal ajoute la
// classe "is-visible" via IntersectionObserver, et c'est le CSS
// (_joy-layer.scss) qui fait le reste : chaque <span> passe de
// width: 0 à sa largeur réelle (--w), avec une transition douce.
//
// Analogie : comme un rideau de théâtre qui s'ouvre quand le
// public regarde la scène, pas avant — la jauge "révèle" son
// résultat au moment où on la découvre en scrollant, plutôt que
// d'arriver déjà pleine (moins d'impact visuel, et un chargement
// de page avec 10 jauges qui s'animent toutes en même temps
// donnerait un effet de foire, pas de sobriété).
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import useScrollReveal from '../../hooks/useScrollReveal.js';

const STATUS_LABELS = {
  PUBLISHED: 'En concertation',
  CLOSED: 'Clôturée',
};

export default function ProposalCard({ proposal }) {
  const barRef = useScrollReveal('is-visible', { threshold: 0.3 });
  const { POUR, CONTRE, NEUTRE } = proposal.votes;
  const total = POUR + CONTRE + NEUTRE;

  // Pourcentages de largeur pour chaque segment de la jauge.
  // Si personne n'a encore voté (total = 0), on évite une division
  // par zéro : les trois segments restent à 0%, la jauge est grise
  // et vide — ce qui est l'état honnête ("pas encore d'avis"),
  // plutôt qu'un pourcentage arbitraire.
  const pct = (n) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return (
    <Link
      to={`/propositions/${proposal.slug}`}
      className="card-joyful"
      style={{
        display: 'block',
        padding: 24,
        textDecoration: 'none',
        color: 'inherit',
        marginBottom: 20,
      }}
    >
      {/* ── Badge de statut ─────────────────────────────── */}
      {proposal.status === 'PUBLISHED' ? (
        <span className="badge-live">{STATUS_LABELS.PUBLISHED}</span>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#6B6257', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          {STATUS_LABELS.CLOSED}
        </span>
      )}

      {/* ── Titre + résumé ──────────────────────────────── */}
      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: '10px 0 6px' }}>
        {proposal.title}
      </h3>
      <p style={{ color: '#6B6257', fontSize: 16, marginBottom: 18, lineHeight: 1.5 }}>
        {proposal.summary}
      </p>

      {/* ── Jauge de vote ────────────────────────────────── */}
      <div className="vote-bar" ref={barRef}>
        <span className="pour" style={{ '--w': `${pct(POUR)}%` }} />
        <span className="neutre" style={{ '--w': `${pct(NEUTRE)}%` }} />
        <span className="contre" style={{ '--w': `${pct(CONTRE)}%` }} />
      </div>

      {/* ── Comptages ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: '#3A7A4D' }}>✓ {POUR} pour</span>
        <span style={{ color: '#6B6257' }}>◯ {NEUTRE} neutre</span>
        <span style={{ color: '#A8442F' }}>✗ {CONTRE} contre</span>
      </div>
    </Link>
  );
}
