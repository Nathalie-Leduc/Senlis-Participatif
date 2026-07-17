// ══════════════════════════════════════════════════════════
// Page détail d'une proposition — /propositions/:slug
//
// Trois publics différents pour la même page :
// - Visiteur non connecté → peut lire, mais un clic sur un
//   bouton de vote l'envoie se connecter d'abord (le choix
//   n'est pas perdu : rejoué automatiquement après connexion —
//   voir handlePendingVote plus bas).
// - Citoyen connecté, email non vérifié → boutons visibles mais
//   désactivés, avec le message expliquant pourquoi (UC-02, 2b).
// - Citoyen connecté et vérifié → vote normalement.
//
// Analogie pour le vote "à bascule" : cliquer sur le bouton déjà
// actif retire le vote (PUT devient DELETE), un peu comme
// rallumer un interrupteur déjà allumé pour l'éteindre — un seul
// geste, un seul bouton, pas un bouton "annuler" séparé à chercher.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';
import VoteButtons from '../components/VoteButtons/VoteButtons.jsx';
import Confetti from '../components/Confetti/Confetti.jsx';
import LazyMapView from '../components/MapView/LazyMapView.jsx';

const PENDING_VOTE_KEY = 'senlis:pendingVote';

export default function PropositionDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isLogged } = useAuth();

  const [proposal, setProposal] = useState(null);
  const [votes, setVotes] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [burst, setBurst] = useState(0); // incrémenté à chaque vote réussi → relance les confettis

  // ── Charger la proposition ──────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/proposals/${slug}`);
      setProposal(data.proposal);
      setVotes(data.votes);
      setMyVote(data.myVote);
    } catch (err) {
      setError(
        err.status === 404
          ? 'Cette proposition n\'existe pas ou plus.'
          : (err.message || 'Impossible de charger cette proposition')
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // ── Envoyer le vote à l'API ──────────────────────────────
  // showConfetti : false pour un retrait de vote (rien à fêter),
  // true pour un vote posé ou changé.
  const submitVote = useCallback(async (value, { showConfetti }) => {
    if (!proposal) return;
    try {
      const isRetrait = value === null;
      const data = isRetrait
        ? await api.delete(`/proposals/${proposal.id}/vote`)
        : await api.put(`/proposals/${proposal.id}/vote`, { value });

      setVotes(data.votes);
      setMyVote(isRetrait ? null : value);
      setToast(isRetrait ? 'Vote retiré' : 'Merci pour votre participation !');
      if (showConfetti) setBurst((b) => b + 1);
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err.message || 'Le vote n\'a pas pu être enregistré');
    }
  }, [proposal]);

  // ── Rejouer un vote laissé en attente avant une connexion ──
  // Si on arrive sur cette page (après /connexion) et qu'un vote
  // était en attente pour CETTE proposition précisément, on le
  // rejoue automatiquement — sans que le citoyen ait à re-cliquer.
  useEffect(() => {
    if (!proposal || !isLogged || !user?.emailVerified) return;

    const raw = sessionStorage.getItem(PENDING_VOTE_KEY);
    if (!raw) return;

    sessionStorage.removeItem(PENDING_VOTE_KEY); // usage unique, qu'il réussisse ou non
    try {
      const pending = JSON.parse(raw);
      if (pending.proposalId === proposal.id) {
        submitVote(pending.value, { showConfetti: true });
      }
    } catch {
      // JSON corrompu — on ignore silencieusement, pas grave
    }
  }, [proposal, isLogged, user, submitVote]);

  // ── Réagir à un clic sur un bouton de vote ──────────────
  const handleSelect = (value) => {
    if (!isLogged) {
      // On mémorise l'intention AVANT de partir se connecter —
      // c'est ce qui permet au vote de "survivre" à l'aller-retour.
      sessionStorage.setItem(PENDING_VOTE_KEY, JSON.stringify({ proposalId: proposal.id, value }));
      navigate(`/connexion?redirect=${encodeURIComponent(`/propositions/${slug}`)}`);
      return;
    }

    if (!user.emailVerified) return; // le message est déjà affiché, rien à faire de plus ici

    // Cliquer sur le bouton déjà actif = retirer son vote.
    // Cliquer sur un autre = voter ou changer d'avis.
    const isRetrait = myVote === value;
    submitVote(isRetrait ? null : value, { showConfetti: !isRetrait });
  };

  // ── États de chargement / erreur ─────────────────────────
  if (loading) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Mascot size="inline" />
        <p style={{ color: '#6B6257', marginTop: 12 }}>Chargement…</p>
      </div>
    );
  }

  if (error && !proposal) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Mascot size="section" speech="Je ne trouve pas cette page…" />
        <p style={{ color: '#6B6257', marginTop: 16 }}>{error}</p>
        <Link to="/propositions" className="btn btn-primary" style={{ marginTop: 20 }}>
          Voir toutes les propositions
        </Link>
      </div>
    );
  }

  const votesClosed = proposal.status !== 'PUBLISHED'
    || (proposal.closesAt && new Date(proposal.closesAt) < new Date());
  const total = votes.POUR + votes.CONTRE + votes.NEUTRE;
  const pct = (n) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return (
    <div className="wrap" style={{ padding: '32px 20px 60px', maxWidth: 720 }}>
      <Confetti trigger={burst} />

      {/* ── Toast de confirmation ────────────────────────── */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#26333A', color: '#fff', padding: '12px 24px', borderRadius: 999,
            fontWeight: 600, fontSize: 15, zIndex: 300, boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          }}
        >
          {toast}
        </div>
      )}

      {/* ── En-tête ──────────────────────────────────────── */}
      {proposal.status === 'PUBLISHED' ? (
        <span className="badge-live">En concertation</span>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 700, color: '#6B6257', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Clôturée
        </span>
      )}
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, margin: '10px 0 6px' }}>
        {proposal.title}
      </h1>
      {proposal.closesAt && (
        <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 20 }}>
          {votesClosed ? 'Clôturé le ' : 'Clôture le '}
          {new Date(proposal.closesAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      {/* ── Image ─────────────────────────────────────────── */}
      {/* Pas de loading="lazy" ici, volontairement : cette image est
          visible DÈS l'arrivée sur la page (en haut, avant tout
          scroll) — la charger "paresseusement" ne ferait que retarder
          quelque chose que l'utilisateur voit immédiatement de toute
          façon. Le lazy loading n'a d'intérêt que pour ce qui est
          hors-écran au chargement, comme les vignettes de la liste
          (voir ProposalCard.jsx). */}
      {proposal.imagePath && (
        <img
          src={proposal.imagePath}
          alt={proposal.title}
          style={{
            width: '100%', maxHeight: 360, objectFit: 'cover',
            borderRadius: 16, marginBottom: 20, display: 'block',
          }}
        />
      )}

      {/* ── Carte ─────────────────────────────────────────── */}
      {/* Le périmètre GeoJSON (tracé exact d'une rue fermée, par
          exemple) reste vide tant que S3-04 (saisie admin) n'existe
          pas — mais la capacité de l'afficher est prête dès qu'un
          admin en saisira un. */}
      {proposal.lat && proposal.lng && (
        <div style={{ marginBottom: 24 }}>
          <LazyMapView
            center={[proposal.lat, proposal.lng]}
            markers={[{ id: proposal.id, lat: proposal.lat, lng: proposal.lng, label: proposal.title }]}
            perimeters={proposal.geoJson}
          />
        </div>
      )}

      {/* ── Argumentaire ─────────────────────────────────── */}
      {/* proposal.content est du texte simple pour l'instant : le
          rendu Markdown (titres, listes, gras…) est laissé pour un
          futur sprint, le temps d'ajouter une petite lib dédiée
          (ex. "marked") plutôt que de réinventer un parseur maison. */}
      <div style={{ fontSize: 17, lineHeight: 1.7, color: '#26333A', marginBottom: 32 }}>
        {proposal.content.split('\n\n').map((paragraph, i) => (
          <p key={i} style={{ marginBottom: 14 }}>{paragraph}</p>
        ))}
      </div>

      {/* ── Jauge de vote ─────────────────────────────────── */}
      <div className="card-joyful" style={{ padding: 24 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 14 }}>
          Résultats
        </h2>

        <div className="vote-bar is-visible" style={{ marginBottom: 10 }}>
          <span className="pour" style={{ '--w': `${pct(votes.POUR)}%` }} />
          <span className="neutre" style={{ '--w': `${pct(votes.NEUTRE)}%` }} />
          <span className="contre" style={{ '--w': `${pct(votes.CONTRE)}%` }} />
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 24, fontSize: 14, fontWeight: 700 }}>
          <span style={{ color: '#3A7A4D' }}>✓ {votes.POUR} pour</span>
          <span style={{ color: '#6B6257' }}>◯ {votes.NEUTRE} neutre</span>
          <span style={{ color: '#A8442F' }}>✗ {votes.CONTRE} contre</span>
        </div>

        {/* ── Message contextuel avant les boutons ─────────── */}
        {votesClosed && (
          <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 14 }}>
            Les votes sont clos pour cette proposition — les résultats ci-dessus sont définitifs.
          </p>
        )}
        {!votesClosed && isLogged && !user.emailVerified && (
          <div style={{ background: '#FFF4DB', color: '#8a6d1f', padding: '12px 16px', borderRadius: 12, marginBottom: 14, fontSize: 15 }}>
            Vérifiez votre adresse email pour pouvoir voter — un lien vous a été envoyé à l'inscription.
          </div>
        )}
        {!votesClosed && !isLogged && (
          <p style={{ color: '#6B6257', fontSize: 15, marginBottom: 14 }}>
            <Link to={`/connexion?redirect=${encodeURIComponent(`/propositions/${slug}`)}`} style={{ fontWeight: 700 }}>
              Connectez-vous
            </Link>{' '}
            pour voter — votre choix sera pris en compte juste après.
          </p>
        )}

        <VoteButtons
          myVote={myVote}
          disabled={votesClosed || (isLogged && !user.emailVerified)}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
