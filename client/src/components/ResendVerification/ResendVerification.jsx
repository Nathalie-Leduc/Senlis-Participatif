// ══════════════════════════════════════════════════════════
// « Renvoyer l'email de vérification » (S5R-01)
//
// Avant : un lien perdu, expiré (60 min) ou mangé par les indésirables
// laissait le compte bloqué pour toujours — impossible de se connecter
// (email non vérifié), impossible de se réinscrire (adresse déjà
// utilisée). Ce petit formulaire, placé partout où l'impasse peut se
// présenter (page de vérification, connexion, inscription, Mon compte),
// ouvre une porte de sortie.
//
// La réponse de l'API est la même que l'adresse existe ou non (anti-
// énumération) : on affiche donc ce message tel quel, sans jamais
// promettre « un email vous a été envoyé ».
// ══════════════════════════════════════════════════════════

import { useState } from 'react';
import { api } from '../../services/api.js';

/**
 * @param {{ defaultEmail?: string, intro?: string }} props
 */
export default function ResendVerification({ defaultEmail = '', intro }) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const data = await api.post('/auth/resend-verification', { email: email.trim() });
      setStatus('sent');
      setMessage(data.message);
    } catch (err) {
      setStatus('error');
      setMessage(err.details ? Object.values(err.details)[0] : err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ marginTop: 16, textAlign: 'left' }}>
      {intro && <p style={{ fontSize: 15, color: '#26333A', marginBottom: 10 }}>{intro}</p>}
      <label htmlFor="resend-email" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
        Votre adresse email
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          id="resend-email" type="email" autoComplete="email" required
          value={email} onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
          aria-invalid={status === 'error' || undefined}
          aria-describedby={status !== 'idle' ? 'resend-status' : undefined}
          style={{ flex: '1 1 220px', padding: '10px 14px', fontSize: 16, border: '2px solid #e3dcce', borderRadius: 12 }}
        />
        <button type="submit" disabled={status === 'sending' || !email.trim()} className="btn btn-primary" style={{ padding: '10px 18px' }}>
          {status === 'sending' ? 'Envoi…' : 'Renvoyer le lien'}
        </button>
      </div>
      {(status === 'sent' || status === 'error') && (
        // status (poli) pour la confirmation, alert pour une erreur
        <p
          id="resend-status" role={status === 'error' ? 'alert' : 'status'}
          style={{ fontSize: 14, marginTop: 8, color: status === 'error' ? '#A8442F' : '#377349' }}
        >
          {message}
        </p>
      )}
    </form>
  );
}
