import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import FormError, { errorProps } from '../components/FormError/FormError.jsx';

export default function MotDePasseOublie() {
  usePageTitle('Mot de passe oublié');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Contrôle de saisie (RGAA 11.10) : un champ vide ou sans « @ »
    // ne peut pas être une adresse. Sans ce contrôle, la page disait
    // « Email envoyé ! » même pour une saisie vide.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Saisissez une adresse email valide, par exemple : prenom@exemple.fr');
      return;
    }
    setError(null);
    setLoading(true);
    try { await api.post('/auth/forgot-password', { email }); }
    catch { /* on ne révèle pas si l'email existe */ }
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <Mascot size="section" speech="Vérifiez votre boîte mail 📬" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '20px 0 12px' }}>Email envoyé !</h1>
        <p style={{ color: '#6B6257', fontSize: 17, lineHeight: 1.6 }}>
          Si cette adresse est associée à un compte, un lien de réinitialisation a été envoyé.
        </p>
        <Link to="/connexion" className="btn btn-primary" style={{ marginTop: 24 }}>Retour à la connexion</Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: '40px 20px', maxWidth: 460, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Mascot size="inline" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 4px' }}>Mot de passe oublié ?</h1>
        <p style={{ color: '#6B6257' }}>Pas de souci — entrez votre email, on vous envoie un lien</p>
      </div>
      <FormError id="forgot-error">{error}</FormError>
      <form onSubmit={handleSubmit} noValidate style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Email</span>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
            autoComplete="email" required placeholder="votreadresse@email.fr"
            {...errorProps(Boolean(error), 'forgot-error')}
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Envoi…' : 'Envoyer le lien'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 20, color: '#6B6257', fontSize: 15 }}>
        <Link to="/connexion">Retour à la connexion</Link>
      </p>
    </div>
  );
}
