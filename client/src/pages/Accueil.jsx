// ══════════════════════════════════════════════════════════
// Page Accueil — le hero joyeux avec la mascotte
//
// C'est la première impression du site. Le cerf accueille,
// les stat pills montrent l'activité, les CTA invitent à
// participer. Tout est préparé pour recevoir les vraies
// données (propositions, enquêtes) aux sprints suivants.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Mascot from '../components/Mascot/Mascot.jsx';

export default function Accueil() {
  const { isLogged } = useAuth();

  return (
    <>
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="section-hero" style={{ padding: '56px 0 60px' }}>
        <div className="hero-blob" style={{
          top: -80, right: -60, width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(212,168,74,.2) 0%, transparent 70%)',
        }} />
        <div className="hero-blob" style={{
          bottom: -100, left: -80, width: 350, height: 350,
          background: 'radial-gradient(circle, rgba(58,122,77,.15) 0%, transparent 70%)',
        }} />

        <div className="wrap" style={{
          display: 'flex', alignItems: 'center', gap: 40,
          flexWrap: 'wrap', position: 'relative', zIndex: 2,
        }}>
          <div style={{ flex: '1 1 320px' }}>
            <h1 style={{
              fontFamily: "'Fraunces', serif", fontWeight: 800,
              fontSize: 'clamp(30px, 5.5vw, 48px)', lineHeight: 1.15,
              marginBottom: 16, color: '#fff',
            }}>
              Votre ville.<br />
              Votre <span style={{ color: '#F0C45A' }}>voix</span>.
            </h1>
            <p style={{
              fontSize: 19, opacity: 0.9, marginBottom: 28,
              color: '#fff', lineHeight: 1.7,
            }}>
              Découvrez les propositions pour Senlis, votez en
              10 secondes et participez aux enquêtes qui comptent vraiment.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <div className="stat-pill"><span className="num">0</span> participants</div>
              <div className="stat-pill"><span className="num">0</span> propositions</div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {isLogged ? (
                <Link to="/propositions" className="btn btn-gold">Voir les propositions</Link>
              ) : (
                <Link to="/inscription" className="btn btn-gold">Je participe !</Link>
              )}
              <Link to="/carte" className="btn btn-ghost">Explorer la carte</Link>
            </div>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <Mascot size="hero" speech="Bienvenue à Senlis ! 🏛️" />
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ─────────────────────────── */}
      <section className="section-how" style={{ padding: '56px 20px 64px' }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, marginBottom: 8 }}>
            Comment ça marche ?
          </h2>
          <p style={{ color: '#6B6257', marginBottom: 36, fontSize: 18 }}>
            Quatre étapes, zéro prise de tête
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 20,
          }}>
            {[
              { icon: '📖', title: 'Découvrez', desc: 'Lisez les propositions argumentées et sourcées', bg: '#E3F0F6', color: '#1E5F7C' },
              { icon: '🗳️', title: 'Votez', desc: 'Pour, contre ou neutre — en 10 secondes', bg: '#FFF4DB', color: '#D4A84A' },
              { icon: '📊', title: 'Répondez', desc: 'Participez aux enquêtes qui éclairent le débat', bg: '#E0F2E5', color: '#3A7A4D' },
              { icon: '🎯', title: 'Impactez', desc: 'Vos résultats sont présentés à la mairie', bg: '#FCEAE6', color: '#A8442F' },
            ].map((step) => (
              <div key={step.title} className="card-joyful" style={{
                padding: '32px 20px', textAlign: 'center', background: step.bg,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: step.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, margin: '0 auto 14px',
                }}>{step.icon}</div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 15, color: '#6B6257', lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────── */}
      <section className="section-cta" style={{ padding: '64px 20px', textAlign: 'center' }}>
        <div className="wrap">
          <Mascot size="section" />
          <h2 style={{
            fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 800,
            marginTop: 20, marginBottom: 12, color: '#fff',
          }}>
            Chaque voix compte.<br />Surtout la vôtre.
          </h2>
          <p style={{ fontSize: 19, opacity: 0.8, marginBottom: 32, color: '#fff' }}>
            Rejoignez les Senlisiens qui construisent la ville de demain
          </p>
          {!isLogged && (
            <Link to="/inscription" className="btn btn-gold">
              Créer mon compte gratuitement
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
