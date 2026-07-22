import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter/PasswordStrengthMeter.jsx';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState(token ? 'form' : 'error');
  const [message, setMessage] = useState(token ? '' : 'Lien invalide — jeton manquant.');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== passwordConfirm) {
      setStatus('form');
      setMessage('Les deux mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const data = await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Jeton invalide ou expiré.');
    }
    setLoading(false);
  };

  if (status === 'success' || status === 'error') {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <Mascot size="section" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '20px 0 12px' }}>
          {status === 'success' ? 'Mot de passe réinitialisé ! ✅' : 'Oups… 😕'}
        </h1>
        <p style={{ color: '#6B6257', fontSize: 17, lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
        <Link to="/connexion" className="btn btn-primary">Se connecter</Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: '40px 20px', maxWidth: 460, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Mascot size="inline" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 4px' }}>Nouveau mot de passe</h1>
      </div>
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
        {message && (
          <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>
            {message}
          </div>
        )}
        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Nouveau mot de passe</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" required minLength={12}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
            title="Au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial"
            placeholder="12 caractères minimum"
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <PasswordStrengthMeter password={password} />

        <label style={{ display: 'block', margin: '16px 0 20px' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Confirmer le mot de passe</span>
          <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password" required placeholder="Retapez le même mot de passe"
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <button onClick={handleSubmit} disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Réinitialisation…' : 'Réinitialiser'}
        </button>
      </div>
    </div>
  );
}
