import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';

export default function MonCompte() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleChangePassword = async () => {
    setError(null); setMessage(null);
    try {
      const data = await api.put('/auth/me/password', pwForm);
      setMessage(data.message);
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer votre compte ? Cette action est irréversible.')) return;
    try {
      await api.delete('/auth/me');
      logout();
      navigate('/');
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="wrap" style={{ padding: '40px 20px', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Mascot size="inline" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0' }}>Mon compte</h1>
      </div>

      {message && <div style={{ background: '#E0F2E5', color: '#3A7A4D', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>{message}</div>}
      {error && <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>{error}</div>}

      {/* Infos du profil */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 16 }}>Profil</h2>
        <p style={{ fontSize: 16, marginBottom: 8 }}><strong>Pseudo :</strong> {user?.pseudo}</p>
        <p style={{ fontSize: 16, marginBottom: 8 }}><strong>Email :</strong> {user?.email}</p>
        <p style={{ fontSize: 16 }}><strong>Email vérifié :</strong> {user?.emailVerified ? '✅ Oui' : '❌ Non'}</p>
      </div>

      {/* Changement de mot de passe */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 16 }}>Changer le mot de passe</h2>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Mot de passe actuel</span>
          <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            autoComplete="current-password" style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Nouveau mot de passe</span>
          <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            autoComplete="new-password" minLength={8} style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <button onClick={handleChangePassword} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Changer le mot de passe</button>
      </div>

      {/* Zone danger */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', border: '2px solid #FCEAE6' }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 12, color: '#A8442F' }}>Zone dangereuse</h2>
        <p style={{ fontSize: 15, color: '#6B6257', marginBottom: 16, lineHeight: 1.6 }}>
          La suppression de votre compte est irréversible. Vos votes seront supprimés et vos réponses d'enquête anonymisées.
        </p>
        <button onClick={handleDelete} style={{
          width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
          background: 'transparent', border: '2px solid #A8442F', borderRadius: 12,
          color: '#A8442F', cursor: 'pointer', fontFamily: "'Public Sans', system-ui",
        }}>Supprimer mon compte</button>
      </div>
    </div>
  );
}
