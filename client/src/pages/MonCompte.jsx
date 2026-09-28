import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter/PasswordStrengthMeter.jsx';
import PasswordInput from '../components/PasswordInput/PasswordInput.jsx';
import { QUARTIER_OPTIONS, TRAVAIL_QUARTIER_OPTIONS, TRAVAIL_TYPE_OPTIONS } from '../constants/situation.js';
import { downloadJson, exportFilename } from '../utils/download.js';
import { errorProps } from '../components/FormError/FormError.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';

export default function MonCompte() {
  usePageTitle('Mon compte');
  const { user, logout, refreshUser, replaceToken } = useAuth();
  const navigate = useNavigate();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [situation, setSituation] = useState(user?.situation || '');
  const [quartier, setQuartier] = useState(user?.quartier || '');
  const [travailleASenlis, setTravailleASenlis] = useState(Boolean(user?.travailleQuartier));
  const [travailleQuartier, setTravailleQuartier] = useState(user?.travailleQuartier || '');
  const [travailType, setTravailType] = useState(user?.travailType || '');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [profileJustSaved, setProfileJustSaved] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [passwordJustChanged, setPasswordJustChanged] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  // S5A-07 (RGAA 11.10) : champ concerné par chaque erreur, pour la
  // relier au bon champ (aria-invalid + aria-describedby)
  const [profileErrorField, setProfileErrorField] = useState(null); // 'quartier' | 'travail'
  const [passwordErrorField, setPasswordErrorField] = useState(null); // 'current' | 'new' | 'confirm'

  const handleUpdateSituation = async () => {
    setError(null); setMessage(null); setProfileJustSaved(false); setProfileError(null);

    // Validé ICI plutôt que par un simple bouton désactivé : un
    // bouton désactivé sans explication ne dit jamais à la personne
    // CE QUI manque — elle clique, rien ne se passe, et elle ne sait
    // pas pourquoi.
    if (situation === 'AUTRE_QUARTIER' && !quartier) {
      setProfileError('Merci de préciser votre quartier.');
      setProfileErrorField('quartier');
      return;
    }
    if (travailleASenlis && (!travailleQuartier || !travailType)) {
      setProfileError('Merci de préciser le quartier de travail et votre rôle.');
      setProfileErrorField('travail');
      return;
    }
    setProfileErrorField(null);

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
      // Confirmation propre à CETTE action, affichée juste sous le
      // bouton — le message partagé tout en haut de la page passe
      // trop facilement inaperçu, trop loin de l'endroit où le
      // regard se trouve au moment du clic.
      setProfileJustSaved(true);
      await refreshUser();
    } catch (err) { setProfileError(err.message); }
  };

  const handleChangePassword = async () => {
    setError(null); setMessage(null); setPasswordJustChanged(false); setPasswordError(null);

    if (pwForm.newPassword !== pwForm.newPasswordConfirm) {
      setPasswordError('Les deux mots de passe ne correspondent pas');
      setPasswordErrorField('confirm');
      return;
    }
    // Le nouveau mot de passe doit être DIFFÉRENT de l'actuel — pour
    // la sécurité, "changer" son mot de passe pour le même ne sert à
    // rien et pourrait laisser croire, à tort, qu'une compromission a
    // été traitée.
    if (pwForm.newPassword === pwForm.currentPassword) {
      setPasswordError('Le nouveau mot de passe doit être différent de l\'actuel');
      setPasswordErrorField('new');
      return;
    }

    try {
      // newPasswordConfirm n'existe que pour cette vérification —
      // l'API attend juste { currentPassword, newPassword }.
      const { newPasswordConfirm, ...payload } = pwForm;
      void newPasswordConfirm;
      const res = await api.put('/auth/me/password', payload);
      // S5A-06 : l'ancien jeton vient d'être révoqué par l'API (comme
      // ceux de tous les autres appareils) — on garde le nouveau.
      if (res?.token) replaceToken(res.token);
      setPasswordJustChanged(true);
      setPwForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      setPasswordErrorField(null);
    } catch (err) {
      // 401 = mot de passe ACTUEL faux ; sinon (mot de passe trop faible,
      // identique à l'ancien…) c'est le NOUVEAU qui pose problème
      setPasswordError(err.details ? Object.values(err.details)[0] : err.message);
      setPasswordErrorField(err.status === 401 ? 'current' : 'new');
    }
  };

  // ── Télécharger mes données (S5A-05, RGPD art. 15 et 20) ──
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await api.get('/auth/me/export');
      downloadJson(data, exportFilename());
    } catch (err) {
      setError(err.message || 'Impossible de préparer vos données');
    } finally {
      setExporting(false);
    }
  };

  // ── Suppression du compte (S5A-06 : mot de passe exigé) ──
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState(null);
  const handleDelete = async (e) => {
    e.preventDefault();
    setDeleteError(null);
    if (!deletePassword) {
      setDeleteError('Saisissez votre mot de passe pour confirmer.');
      return;
    }
    // Double sécurité : le mot de passe prouve QUI supprime, la
    // confirmation vérifie que c'est bien VOULU (un clic de trop).
    if (!confirm('Supprimer votre compte ? Cette action est irréversible.')) return;
    try {
      await api.delete('/auth/me', { password: deletePassword });
      logout();
      navigate('/');
    } catch (err) {
      setDeleteError(err.message);
    }
  };

  return (
    <div className="wrap" style={{ padding: '40px 20px', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Mascot size="inline" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0' }}>Mon compte</h1>
      </div>

      {/* #377349 plutôt que #3A7A4D : audit accessibilité (S5-05),
          contraste AA insuffisant (4,42:1) sur ce fond clair. */}
      {message && <div role="status" style={{ background: '#E0F2E5', color: '#377349', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>{message}</div>}
      {error && <div role="alert" style={{ background: '#FCEAE6', color: '#A8442F', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 15 }}>{error}</div>}

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
              setProfileJustSaved(false); setProfileError(null);
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
              value={quartier} onChange={(e) => { setQuartier(e.target.value); setProfileJustSaved(false); setProfileError(null); setProfileErrorField(null); }}
              {...errorProps(profileErrorField === 'quartier', 'profile-error')}
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
              setProfileJustSaved(false); setProfileError(null);
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
                value={travailleQuartier} onChange={(e) => { setTravailleQuartier(e.target.value); setProfileJustSaved(false); setProfileError(null); setProfileErrorField(null); }}
                {...errorProps(profileErrorField === 'travail' && !travailleQuartier, 'profile-error')}
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
                value={travailType} onChange={(e) => { setTravailType(e.target.value); setProfileJustSaved(false); setProfileError(null); setProfileErrorField(null); }}
                {...errorProps(profileErrorField === 'travail' && !travailType, 'profile-error')}
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
          disabled={!situation
            || (situation === user?.situation && quartier === (user?.quartier || '')
              && travailleASenlis === Boolean(user?.travailleQuartier)
              && travailleQuartier === (user?.travailleQuartier || '')
              && travailType === (user?.travailType || ''))}
          className="btn" style={{ background: '#EFEBE2', color: '#26333A' }}
        >
          Mettre à jour mon profil
        </button>
        {/* role="status" : confirmation LUE par les lecteurs d'écran
            (poliment, sans interrompre) ; role="alert" pour une erreur */}
        {profileJustSaved && (
          <p role="status" style={{ color: '#377349', fontWeight: 600, fontSize: 15, marginTop: 10 }}>
            ✅ Votre profil a été mis à jour.
          </p>
        )}
        {profileError && (
          <p id="profile-error" role="alert" style={{ color: '#A8442F', fontWeight: 600, fontSize: 15, marginTop: 10 }}>
            {profileError}
          </p>
        )}
      </div>

      {/* Changement de mot de passe */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 16 }}>Changer le mot de passe</h2>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Mot de passe actuel</span>
          <PasswordInput value={pwForm.currentPassword} onChange={(e) => { setPwForm({ ...pwForm, currentPassword: e.target.value }); setPasswordJustChanged(false); setPasswordError(null); setPasswordErrorField(null); }}
            {...errorProps(passwordErrorField === 'current', 'password-error')}
            autoComplete="current-password" style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Nouveau mot de passe</span>
          <PasswordInput value={pwForm.newPassword} onChange={(e) => { setPwForm({ ...pwForm, newPassword: e.target.value }); setPasswordJustChanged(false); setPasswordError(null); setPasswordErrorField(null); }}
            {...errorProps(passwordErrorField === 'new', 'password-error')}
            autoComplete="new-password" minLength={12}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
            title="Au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial"
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <PasswordStrengthMeter password={pwForm.newPassword} />

        <label style={{ display: 'block', margin: '16px 0 16px' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Confirmer le nouveau mot de passe</span>
          <PasswordInput value={pwForm.newPasswordConfirm} onChange={(e) => { setPwForm({ ...pwForm, newPasswordConfirm: e.target.value }); setPasswordJustChanged(false); setPasswordError(null); setPasswordErrorField(null); }}
            {...errorProps(passwordErrorField === 'confirm', 'password-error')}
            autoComplete="new-password"
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }} />
        </label>
        <button onClick={handleChangePassword} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Changer le mot de passe</button>
        {passwordJustChanged && (
          <p role="status" style={{ color: '#377349', fontWeight: 600, fontSize: 15, marginTop: 10 }}>
            ✅ Votre mot de passe a été changé.
          </p>
        )}
        {passwordError && (
          <p id="password-error" role="alert" style={{ color: '#A8442F', fontWeight: 600, fontSize: 15, marginTop: 10 }}>
            {passwordError}
          </p>
        )}
      </div>

      {/* Mes données (S5A-05) — placé AVANT la zone dangereuse : on
          propose de récupérer ses données avant de tout effacer. */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 12 }}>Mes données</h2>
        <p style={{ fontSize: 15, color: '#6B6257', marginBottom: 16, lineHeight: 1.6 }}>
          Téléchargez tout ce que Senlis Participatif sait de vous — compte, profil, votes et
          réponses aux enquêtes — dans un fichier JSON, lisible par vous comme par un autre logiciel.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          aria-busy={exporting}
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: 16 }}
        >
          {exporting ? 'Préparation du fichier…' : 'Télécharger mes données'}
        </button>
      </div>

      {/* Zone danger */}
      <div style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)', border: '2px solid #FCEAE6' }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 12, color: '#A8442F' }}>Zone dangereuse</h2>
        <p style={{ fontSize: 15, color: '#6B6257', marginBottom: 16, lineHeight: 1.6 }}>
          La suppression de votre compte est irréversible. Vos votes seront supprimés et vos réponses d'enquête anonymisées.
        </p>
        {/* Un vrai <form> : la touche Entrée valide, et le navigateur
            comprend qu'il s'agit d'une saisie de mot de passe. */}
        <form onSubmit={handleDelete} noValidate>
          <label htmlFor="delete-password" style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Mot de passe actuel (pour confirmer)
          </label>
          <PasswordInput
            id="delete-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(deleteError)}
            aria-describedby={deleteError ? 'delete-error' : undefined}
            style={{ width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" }}
          />
          {deleteError && (
            <p id="delete-error" role="alert" style={{ color: '#A8442F', fontSize: 14, margin: '8px 0 0' }}>
              {deleteError}
            </p>
          )}
          <button type="submit" style={{
            width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, marginTop: 12,
            background: 'transparent', border: '2px solid #A8442F', borderRadius: 12,
            color: '#A8442F', cursor: 'pointer', fontFamily: "'Public Sans', system-ui",
          }}>Supprimer mon compte</button>
        </form>
      </div>
    </div>
  );
}
