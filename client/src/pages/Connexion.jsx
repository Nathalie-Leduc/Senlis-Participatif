import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Mascot from '../components/Mascot/Mascot.jsx';

export default function Connexion() {
  const { login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Non-null dès qu'un compte ADMIN a réussi l'étape mot de passe —
  // on bascule alors sur l'écran "code reçu par email" plutôt que de
  // rester sur le formulaire email/mot de passe.
  const [challengeToken, setChallengeToken] = useState(null);
  const [code, setCode] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  };

  // Même redirection dans les deux cas (connexion directe OU après
  // le code 2FA) — d'où son extraction dans sa propre fonction
  // plutôt que dupliquée dans handleSubmit ET handleVerifyCode.
  //
  // ?redirect=/propositions/xxx permet de revenir exactement là où
  // on était avant d'être invité à se connecter — ex. sur une
  // proposition, pour que le vote qu'on voulait faire puisse être
  // rejoué automatiquement (voir PropositionDetail.jsx). On ne fait
  // confiance qu'à un chemin interne commençant par "/" — jamais à
  // une URL complète, pour éviter qu'un lien piégé ne redirige vers
  // un site externe après connexion.
  const redirectAfterLogin = () => {
    const redirect = searchParams.get('redirect');
    navigate(redirect && redirect.startsWith('/') ? redirect : '/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login(form);
      if (data.twoFactorRequired) {
        setChallengeToken(data.challengeToken);
      } else {
        redirectAfterLogin();
      }
    } catch (err) {
      setError(err.message || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await verifyTwoFactor({ challengeToken, code });
      redirectAfterLogin();
    } catch (err) {
      setError(err.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  // ── Écran 2 : saisie du code reçu par email ────────────
  if (challengeToken) {
    return (
      <div className="wrap" style={{ padding: '40px 20px', maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Mascot size="inline" />
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 4px' }}>
            Vérification en deux étapes
          </h1>
          <p style={{ color: '#6B6257' }}>
            Un code à 6 chiffres vient de vous être envoyé par email — il expire dans 10 minutes.
          </p>
        </div>

        {error && (
          <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>
            {error}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
          <label style={{ display: 'block', marginBottom: 24 }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Code de connexion</span>
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
              autoComplete="one-time-code" required autoFocus
              placeholder="000000"
              style={{ ...inputStyle, textAlign: 'center', fontSize: 28, letterSpacing: 8, fontFamily: "'Courier New', monospace" }}
            />
          </label>

          <button
            onClick={handleVerifyCode} disabled={loading || code.length !== 6}
            className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? 'Vérification…' : 'Valider'}
          </button>
        </div>

        <button
          onClick={() => { setChallengeToken(null); setCode(''); setError(null); }}
          style={{ display: 'block', margin: '20px auto 0', background: 'none', border: 'none', color: '#6B6257', cursor: 'pointer', fontSize: 15 }}
        >
          ← Revenir à l'identifiant/mot de passe
        </button>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: '40px 20px', maxWidth: 460, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Mascot size="inline" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 4px' }}>
          Content de vous revoir !
        </h1>
        <p style={{ color: '#6B6257' }}>Connectez-vous pour participer</p>
      </div>

      {error && (
        <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Email</span>
          <input type="email" name="email" value={form.email} onChange={handleChange}
            autoComplete="email" required placeholder="votreadresse@email.fr"
            style={inputStyle} />
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Mot de passe</span>
          <input type="password" name="password" value={form.password} onChange={handleChange}
            autoComplete="current-password" required placeholder="Votre mot de passe"
            style={inputStyle} />
        </label>

        <button onClick={handleSubmit} disabled={loading} className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 15 }}>
          <Link to="/mot-de-passe-oublie" style={{ color: '#6B6257' }}>Mot de passe oublié ?</Link>
        </p>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, color: '#6B6257', fontSize: 15 }}>
        Pas encore inscrit ?{' '}
        <Link to="/inscription" style={{ fontWeight: 600 }}>Créer un compte</Link>
      </p>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 16px', fontSize: 17,
  border: '2px solid #e3dcce', borderRadius: 12,
  fontFamily: "'Public Sans', system-ui, sans-serif",
};
