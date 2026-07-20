// ══════════════════════════════════════════════════════════
// Page détail d'une enquête — /enquetes/:slug
//
// Le rôle que joue PropositionDetail pour une proposition : la
// page d'atterrissage avant d'agir. Ici, "agir" = soit répondre
// (si ouverte et pas encore fait), soit consulter les résultats.
//
// hasResponded vient de l'API (S4-05) : null pour un visiteur
// anonyme (on ne SAIT pas s'il a déjà répondu, différent de "non").
// ══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';

export default function EnqueteDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isLogged } = useAuth();

  const [survey, setSurvey] = useState(null);
  const [hasResponded, setHasResponded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    api.get(`/surveys/${slug}`)
      .then((data) => {
        setSurvey(data.survey);
        setHasResponded(data.hasResponded);
      })
      .catch((err) => setError(
        err.status === 404
          ? "Cette enquête n'existe pas ou plus."
          : (err.message || 'Impossible de charger cette enquête'),
      ))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="wrap" style={{ padding: '60px 20px' }}>Chargement…</div>;
  }

  if (error || !survey) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Mascot size="section" speech="Je me suis perdu dans la forêt… 🌲" />
        <p style={{ color: '#6B6257', marginTop: 16 }}>{error}</p>
        <Link to="/enquetes" className="btn btn-primary" style={{ marginTop: 20 }}>
          Voir toutes les enquêtes
        </Link>
      </div>
    );
  }

  const isOpen = survey.status === 'OPEN';

  // Même logique que PropositionDetail pour le vote : on propose
  // TOUJOURS de répondre si l'enquête est ouverte et qu'on ne SAIT
  // PAS déjà que la personne a répondu (hasResponded !== true couvre
  // à la fois false ET null/anonyme) — c'est le clic qui décide quoi
  // faire ensuite (répondre directement, ou passer par la connexion
  // d'abord), jamais l'affichage du bouton lui-même.
  const canOfferToRespond = isOpen && hasResponded !== true;

  const handleRespond = () => {
    if (!isLogged) {
      navigate(`/connexion?redirect=${encodeURIComponent(`/enquetes/${slug}/repondre`)}`);
      return;
    }
    navigate(`/enquetes/${slug}/repondre`);
  };

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 720 }}>
      <span style={{
        fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px',
        color: isOpen ? '#3A7A4D' : '#6B6257',
      }}>
        {isOpen ? 'Enquête ouverte' : 'Enquête clôturée'}
      </span>

      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, margin: '10px 0 14px' }}>
        {survey.title}
      </h1>

      <p style={{ fontSize: 17, lineHeight: 1.7, color: '#26333A', marginBottom: 20 }}>
        {survey.description}
      </p>

      <p style={{ color: '#6B6257', fontSize: 14, marginBottom: 28 }}>
        {survey.questions.length} question{survey.questions.length > 1 ? 's' : ''}
        {survey.closesAt && (
          ` — clôture le ${new Date(survey.closesAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
        )}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {canOfferToRespond && (
          <button onClick={handleRespond} className="btn btn-primary">
            Répondre à l'enquête
          </button>
        )}
        {isOpen && hasResponded === true && (
          <span style={{ color: '#3A7A4D', fontWeight: 700 }}>✓ Vous avez déjà répondu — merci !</span>
        )}
        <Link
          to={`/enquetes/${slug}/resultats`}
          className="btn"
          style={{ background: '#EFEBE2', color: '#26333A' }}
        >
          Voir les résultats
        </Link>
      </div>
    </div>
  );
}
