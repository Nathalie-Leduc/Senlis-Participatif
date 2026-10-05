// Page de vérification — appelée quand l'utilisateur clique le lien dans l'email
//
// S5R-01 : le jeton n'est plus envoyé qu'UNE fois (verifyEmailOnce),
// un lien déjà utilisé sur un compte vérifié s'affiche comme un succès,
// et un lien expiré ou invalide propose d'en recevoir un nouveau.
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Mascot from '../components/Mascot/Mascot.jsx';
import ResendVerification from '../components/ResendVerification/ResendVerification.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import { verifyEmailOnce } from '../utils/verifyEmailOnce.js';

export default function VerificationEmail() {
  usePageTitle('Vérification de l’adresse email');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Jeton manquant dans le lien.'); return; }
    // `cancelled` : si le composant est démonté entre-temps (StrictMode
    // le fait volontairement en développement), on n'écrit plus dans
    // son état — c'est le montage suivant qui affichera la réponse.
    let cancelled = false;
    verifyEmailOnce(token)
      .then((data) => { if (!cancelled) { setStatus('success'); setMessage(data.message); } })
      .catch((err) => { if (!cancelled) { setStatus('error'); setMessage(err.message || 'Jeton invalide ou expiré.'); } });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
      <Mascot size="section" speech={status === 'success' ? 'Bienvenue ! 🎉' : undefined} />
      <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '20px 0 12px' }}>
        {status === 'loading' && 'Vérification en cours…'}
        {status === 'success' && 'Email vérifié ! ✅'}
        {status === 'error' && 'Ce lien ne fonctionne plus 😕'}
      </h1>
      <p role={status === 'error' ? 'alert' : 'status'} style={{ color: '#6B6257', fontSize: 17, lineHeight: 1.6, marginBottom: 24 }}>
        {message}
      </p>
      {status === 'success' && (
        <Link to="/connexion" className="btn btn-primary">Se connecter</Link>
      )}
      {status === 'error' && (
        // Plus de « Réessayer l'inscription » : le compte EXISTE déjà
        // (se réinscrire donnait « adresse déjà utilisée »). Ce qu'il
        // faut, c'est un nouveau lien.
        <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
          <ResendVerification intro="Les liens sont valables 60 minutes et ne servent qu'une fois. Recevez-en un nouveau :" />
          <p style={{ fontSize: 14, marginTop: 16 }}>
            Adresse déjà vérifiée ? <Link to="/connexion">Se connecter</Link>
          </p>
        </div>
      )}
    </div>
  );
}
