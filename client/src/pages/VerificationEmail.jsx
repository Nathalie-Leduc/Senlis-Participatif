// Page de vérification — appelée quand l'utilisateur clique le lien dans l'email
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';

export default function VerificationEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Jeton manquant dans le lien.'); return; }
    api.post('/auth/verify-email', { token })
      .then((data) => { setStatus('success'); setMessage(data.message); })
      .catch((err) => { setStatus('error'); setMessage(err.message || 'Jeton invalide ou expiré.'); });
  }, [token]);

  return (
    <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
      <Mascot size="section" speech={status === 'success' ? 'Bienvenue ! 🎉' : undefined} />
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '20px 0 12px' }}>
        {status === 'loading' && 'Vérification en cours…'}
        {status === 'success' && 'Email vérifié ! ✅'}
        {status === 'error' && 'Oups… 😕'}
      </h1>
      <p style={{ color: '#6B6257', fontSize: 17, lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
      {status === 'success' && (
        <Link to="/connexion" className="btn btn-primary">Se connecter</Link>
      )}
      {status === 'error' && (
        <Link to="/inscription" className="btn btn-ghost" style={{ border: '2px solid #1E5F7C', color: '#1E5F7C' }}>
          Réessayer l'inscription
        </Link>
      )}
    </div>
  );
}
