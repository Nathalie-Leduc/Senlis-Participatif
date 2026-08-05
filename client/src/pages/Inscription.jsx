// ══════════════════════════════════════════════════════════
// Page Inscription — création de compte
// ══════════════════════════════════════════════════════════

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Mascot from '../components/Mascot/Mascot.jsx';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter/PasswordStrengthMeter.jsx';
import { QUARTIER_OPTIONS } from '../constants/situation.js';

export default function Inscription() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    pseudo: '', email: '', password: '', passwordConfirm: '', consent: false, situation: '', quartier: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Le quartier précédemment choisi n'a plus de sens si on quitte
      // "autre quartier" — sans ce reset, une valeur périmée resterait
      // en mémoire et partirait quand même vers l'API.
      ...(name === 'situation' && value !== 'AUTRE_QUARTIER' && { quartier: '' }),
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Vérifié côté client AVANT l'appel réseau : pas la peine
    // d'attendre une réponse serveur pour une faute de frappe que
    // l'utilisateur peut corriger tout de suite.
    if (form.password !== form.passwordConfirm) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }

    if (!form.consent) {
      setError("Merci d'accepter la politique de confidentialité pour continuer");
      return;
    }

    setLoading(true);

    try {
      // passwordConfirm et consent n'existent que pour ce formulaire —
      // quartier n'est envoyé que s'il est vraiment renseigné (Zod
      // refuserait une chaîne vide comme valeur d'enum).
      const { passwordConfirm, consent, quartier, ...rest } = form;
      void passwordConfirm;
      void consent;
      const payload = { ...rest, ...(quartier && { quartier }) };
      const data = await register(payload);
      setSuccess(data.message);
    } catch (err) {
      // Si l'API renvoie des détails de validation (Zod),
      // on les affiche champ par champ
      if (err.details) {
        const firstError = Object.values(err.details)[0];
        setError(firstError);
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
        <Mascot size="section" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '20px 0 12px' }}>
          Presque terminé ! ✉️
        </h1>
        <p style={{ color: '#6B6257', fontSize: 17, lineHeight: 1.6 }}>
          {success}
        </p>
        <Link to="/connexion" className="btn btn-primary" style={{ marginTop: 24 }}>
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: '40px 20px', maxWidth: 460, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Mascot size="inline" />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: '12px 0 4px' }}>
          Rejoignez Senlis Participatif
        </h1>
        <p style={{ color: '#6B6257' }}>
          Votre voix compte — créez votre compte en 30 secondes
        </p>
      </div>

      {error && (
        <div style={{
          background: '#FCEAE6', color: '#A8442F', padding: '12px 16px',
          borderRadius: 12, marginBottom: 16, fontSize: 15,
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: '#fff', borderRadius: 24, padding: 28,
        boxShadow: '0 2px 8px rgba(38,51,58,.06)',
      }}>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Pseudo</span>
          <input
            type="text" name="pseudo" value={form.pseudo} onChange={handleChange}
            autoComplete="username" required minLength={2} maxLength={30}
            placeholder="Votre pseudo public"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Email</span>
          <input
            type="email" name="email" value={form.email} onChange={handleChange}
            autoComplete="email" required
            placeholder="votreadresse@email.fr"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Votre situation</span>
          <select
            name="situation" value={form.situation} onChange={handleChange}
            required style={inputStyle}
          >
            <option value="" disabled>Choisissez votre situation</option>
            <option value="CENTRE_RESIDENT">J&apos;habite le centre historique</option>
            <option value="CENTRE_COMMERCANT">Je commerce/travaille dans le centre historique</option>
            <option value="AUTRE_QUARTIER">J&apos;habite un autre quartier de Senlis</option>
            <option value="HORS_SENLIS">Je ne réside pas à Senlis</option>
          </select>
          <p style={{ fontSize: 13, color: '#6B6257', marginTop: 4 }}>
            Sert à cibler certaines enquêtes (ex. stationnement centre-ville) — jamais vérifié, modifiable à tout moment dans Mon compte.
          </p>
        </label>

        {/* Menu en cascade : affiché seulement pour "autre quartier",
            pour que ces citoyens précisent lequel plutôt que de rester
            dans une case fourre-tout — utile pour cibler de futures
            enquêtes/propositions par quartier. */}
        {form.situation === 'AUTRE_QUARTIER' && (
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Quel quartier ?</span>
            <select
              name="quartier" value={form.quartier} onChange={handleChange}
              required style={inputStyle}
            >
              <option value="" disabled>Choisissez votre quartier</option>
              {QUARTIER_OPTIONS.map((q) => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Mot de passe</span>
          <input
            type="password" name="password" value={form.password} onChange={handleChange}
            autoComplete="new-password" required minLength={12}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
            title="Au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial"
            placeholder="12 caractères minimum"
            style={inputStyle}
          />
        </label>
        <PasswordStrengthMeter password={form.password} />

        <label style={{ display: 'block', margin: '16px 0 24px' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Confirmer le mot de passe</span>
          <input
            type="password" name="passwordConfirm" value={form.passwordConfirm} onChange={handleChange}
            autoComplete="new-password" required
            placeholder="Retapez le même mot de passe"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, fontSize: 14, color: '#26333A' }}>
          <input
            type="checkbox" checked={form.consent}
            onChange={(e) => { setForm({ ...form, consent: e.target.checked }); setError(null); }}
            required style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }}
          />
          <span>
            J'ai lu et j'accepte la{' '}
            <Link to="/confidentialite" target="_blank" style={{ fontWeight: 600 }}>
              politique de confidentialité
            </Link>
          </span>
        </label>

        <button
          onClick={handleSubmit} disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? 'Création en cours…' : 'Créer mon compte'}
        </button>
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, color: '#6B6257', fontSize: 15 }}>
        Déjà inscrit ?{' '}
        <Link to="/connexion" style={{ fontWeight: 600 }}>Se connecter</Link>
      </p>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 16px', fontSize: 17,
  border: '2px solid #e3dcce', borderRadius: 12,
  fontFamily: "'Public Sans', system-ui, sans-serif",
  outline: 'none', transition: 'border-color .2s',
};
