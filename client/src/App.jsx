// ══════════════════════════════════════════════════════════
// App — Point d'entrée React
//
// Sprint 0 : squelette minimal avec le hero joyeux et la
// mascotte. Les routes (React Router) arriveront au Sprint 1.
// ══════════════════════════════════════════════════════════

import Mascot from './components/Mascot/Mascot.jsx';

export default function App() {
  return (
    <>
      {/* Skip link : premier élément focusable (accessibilité) */}
      <a href="#main" className="skip-link">Aller au contenu</a>

      {/* ── Header ──────────────────────────────────────── */}
      <header style={{
        background: '#fff',
        borderBottom: '2px solid #FFF4DB',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="wrap" style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 20px',
          gap: 10,
        }}>
          <span style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 700,
            fontSize: 19,
            color: '#26333A',
          }}>
            🦌 Senlis Participatif
          </span>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <main id="main">
        <section className="section-hero" style={{ padding: '56px 20px 60px' }}>
          {/* Blobs décoratifs */}
          <div className="hero-blob" style={{
            top: -80, right: -60, width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(212,168,74,.2) 0%, transparent 70%)',
          }} />
          <div className="hero-blob" style={{
            bottom: -100, left: -80, width: 350, height: 350,
            background: 'radial-gradient(circle, rgba(58,122,77,.15) 0%, transparent 70%)',
          }} />

          <div className="wrap" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 40,
            flexWrap: 'wrap',
            position: 'relative',
            zIndex: 2,
          }}>
            <div style={{ flex: '1 1 320px' }}>
              <h1 style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 'clamp(30px, 5.5vw, 48px)',
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: 16,
                color: '#fff',
              }}>
                Votre ville.<br />
                Votre <span style={{ color: '#F0C45A' }}>voix</span>.
              </h1>
              <p style={{
                fontSize: 19,
                opacity: 0.9,
                marginBottom: 28,
                color: '#fff',
                lineHeight: 1.7,
              }}>
                Découvrez les propositions pour Senlis, votez en
                10 secondes et participez aux enquêtes qui comptent
                vraiment.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <div className="stat-pill"><span className="num">0</span> participants</div>
                <div className="stat-pill"><span className="num">0</span> propositions</div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-gold">Je participe !</button>
                <button className="btn btn-ghost">Explorer la carte</button>
              </div>
            </div>

            {/* La mascotte hero — Sprint 0, palier 1 (statique + bulle) */}
            <div style={{ flex: '0 0 auto' }}>
              <Mascot size="hero" speech="Bienvenue à Senlis ! 🏛️" />
            </div>
          </div>
        </section>

        {/* ── Placeholder des sections suivantes ─────────── */}
        <section className="section-how" style={{ padding: '56px 20px', textAlign: 'center' }}>
          <div className="wrap">
            <h2 style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 32,
              marginBottom: 8,
            }}>
              Comment ça marche ?
            </h2>
            <p style={{ color: '#6B6257', marginBottom: 24 }}>
              Les propositions, votes et enquêtes arrivent aux prochains sprints.
              Pour l'instant, le cerf veille. 🦌
            </p>
            <Mascot size="section" />
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{
        background: '#26333A',
        color: 'rgba(255,255,255,0.6)',
        padding: '28px 20px',
        textAlign: 'center',
        fontSize: 14,
      }}>
        <p><strong style={{ color: '#F0C45A' }}>Senlis Participatif</strong> · Plateforme citoyenne indépendante</p>
        <p style={{ marginTop: 4 }}>🦌 Aucun cerf n'a été blessé pendant la fabrication de ce site</p>
      </footer>
    </>
  );
}
