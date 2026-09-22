import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter/PasswordStrengthMeter.jsx';
import { QUARTIER_OPTIONS, TRAVAIL_QUARTIER_OPTIONS, TRAVAIL_TYPE_OPTIONS } from '../constants/situation.js';

export default function MonCompte() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [situation, setSituation] = useState(user?.situation || '');
  const [quartier, setQuartier] = useState(user?.quartier || '');
  const [travailleASenlis, setTravailleASenlis] = useState(Boolean(user?.travailleQuartier));
  const [travailleQuartier, setTravailleQuartier] = useState(user?.travailleQuartier || '');
  const [travailType, setTravailType] = useState(user?.travailType || '');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleUpdateSituation = async () => {
    setError(null); setMessage(null);
    try {
      const payload = { situation };
      // N'envoyer quartier que s'il est vraiment renseigné (Zod
      // refuserait une chaîne vide) — et seulement pertinent pour
      // "autre quartier" de toute façon.
      if (situation === 'AUTRE_QUARTIER' && quartier) payload.quartier = quartier;
      // Même principe pour l'axe travail, indépendant de situation —
      // TOUJOURS envoyé (jamais omis), y compris explicitement null
      // quand la case est décochée : un champ absent du corps ne
      // change rien côté serveur, alors qu'un null efface vraiment
      // une valeur précédente (voir updateProfile côté contrôleur).
      payload.travailleQuartier = travailleASenlis ? (travailleQuartier || null) : null;
      payload.travailType = travailleASenlis ? (travailType || null) : null;
      await api.patch('/auth/me', payload);
      setMessage('Profil mis à jour.');
      await refreshUser();
    } catch (err) { setError(err.message); }
  };

  const handleChangePassword = async () => {
    setError(null); setMessage(null);

    if (pwForm.newPassword !== pwForm.newPasswordConfirm) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }

    try {
      // newPasswordConfirm n'existe que pour cette vérification —
      // l'API attend juste { currentPassword, newPassword }.
      const { newPasswordConfirm, ...payload } = pwForm;
      void newPasswordConfirm;
      const data = await api.put('/auth/me/password', payload);
      setMessage(data.message);
      setPwForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
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

      {/* #377349 plutôt que #3A7A4D : audit accessibilité (S5-05),
          contraste AA insuffisant (4,42:1) sur ce fond clair. */}
      {message && <div style={{ background: '#E0F2E5', color: '#377349', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>{message}</div>}
      {error && <div style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>{error}</div>}

      {/* Infos du profil */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 16 }}>Profil</h2>
        <p style={{ fontSize: 16, marginBottom: 8 }}><strong>Pseudo :</strong> {user?.pseudo}</p>
        <p style={{ fontSize: 16, marginBottom: 8 }}><strong>Email :</strong> {user?.email}</p>
        <p style={{ fontSize: 16 }}><strong>Email vérifié :</strong> {user?.emailVerified ? '✅ Oui' : '❌ Non'}</p>

        <label style={{ display: 'block', margin: '16px 0 8px' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Votre situation</span>
          <select
            value={situation}
            onChange={(e) => {
              setSituation(e.target.value);
              // Le quartier précédemment choisi n'a plus de sens si on
              // quitte "autre quartier" — sans ce reset, une valeur
              // périmée resterait en mémoire et partirait quand même.
              if (e.target.value !== 'AUTRE_QUARTIER') setQuartier('');
            }}
            style={{ width: '100%', padding: '12px 16px', fontSize: 16, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }}
          >
            <option value="" disabled>Choisissez votre situation</option>
            <option value="CENTRE_RESIDENT">J&apos;habite le centre historique</option>
            <option value="AUTRE_QUARTIER">J&apos;habite un autre quartier de Senlis</option>
            <option value="HORS_SENLIS">Je ne réside pas à Senlis</option>
          </select>
        </label>

        {situation === 'AUTRE_QUARTIER' && (
          <label style={{ display: 'block', margin: '0 0 16px' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Quel quartier ?</span>
            <select
              value={quartier} onChange={(e) => setQuartier(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', fontSize: 16, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }}
            >
              <option value="" disabled>Choisissez votre quartier</option>
              {QUARTIER_OPTIONS.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px', fontSize: 15 }}>
          <input
            type="checkbox" checked={travailleASenlis}
            onChange={(e) => {
              const checked = e.target.checked;
              setTravailleASenlis(checked);
              if (!checked) { setTravailleQuartier(''); setTravailType(''); }
            }}
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
          <span>Je travaille ou dirige une activité à Senlis</span>
        </label>

        {travailleASenlis && (
          <>
            <label style={{ display: 'block', margin: '0 0 16px' }}>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Dans quel quartier ?</span>
              <select
                value={travailleQuartier} onChange={(e) => setTravailleQuartier(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', fontSize: 16, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }}
              >
                <option value="" disabled>Choisissez le quartier</option>
                {TRAVAIL_QUARTIER_OPTIONS.map((q) => (
                  <option key={q.value} value={q.value}>{q.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'block', margin: '0 0 16px' }}>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>À ce titre...</span>
              <select
                value={travailType} onChange={(e) => setTravailType(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', fontSize: 16, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }}
              >
                <option value="" disabled>Précisez</option>
                {TRAVAIL_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <button
          onClick={handleUpdateSituation}
          disabled={!situation || (situation === 'AUTRE_QUARTIER' && !quartier)
            || (travailleASenlis && (!travailleQuartier || !travailType))
            || (situation === user?.situation && quartier === (user?.quartier || '')
              && travailleASenlis === Boolean(user?.travailleQuartier)
              && travailleQuartier === (user?.travailleQuartier || '')
              && travailType === (user?.travailType || ''))}
          className="btn" style={{ background: '#EFEBE2', color: '#26333A' }}
        >
          Mettre à jour mon profil
        </button>
      </div>

      {/* Changement de mot de passe */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 16 }}>Changer le mot de passe</h2>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Mot de passe actuel</span>
          <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            autoComplete="current-password" style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Nouveau mot de passe</span>
          <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            autoComplete="new-password" minLength={12}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
            title="Au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial"
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <PasswordStrengthMeter password={pwForm.newPassword} />

        <label style={{ display: 'block', margin: '16px 0 16px' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Confirmer le nouveau mot de passe</span>
          <input type="password" value={pwForm.newPasswordConfirm} onChange={(e) => setPwForm({ ...pwForm, newPasswordConfirm: e.target.value })}
            autoComplete="new-password"
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
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
