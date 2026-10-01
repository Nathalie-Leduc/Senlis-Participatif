// ══════════════════════════════════════════════════════════
// Page Inscription — création de compte
// ══════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Mascot from '../components/Mascot/Mascot.jsx';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter/PasswordStrengthMeter.jsx';
import PasswordInput from '../components/PasswordInput/PasswordInput.jsx';
import { QUARTIER_OPTIONS, TRAVAIL_QUARTIER_OPTIONS, TRAVAIL_TYPE_OPTIONS } from '../constants/situation.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import FormError from '../components/FormError/FormError.jsx';
import FieldError from '../components/FieldError/FieldError.jsx';
import EmailSuggestion from '../components/EmailSuggestion/EmailSuggestion.jsx';
import { useFieldValidation, focusField } from '../hooks/useFieldValidation.js';
import {
  validateEmail, validatePseudo, validateNewPassword, validatePasswordConfirm, required,
} from '../utils/formValidation.js';
import ResendVerification from '../components/ResendVerification/ResendVerification.jsx';
import { loadRegisterDraft, saveRegisterDraft, clearRegisterDraft } from '../utils/registerDraft.js';

export default function Inscription() {
  usePageTitle('Créer un compte');
  const { register } = useAuth();
  const [form, setForm] = useState({
    pseudo: '', email: '', password: '', passwordConfirm: '', consent: false, situation: '', quartier: '',
    // travailleASenlis n'existe que pour l'affichage (afficher/masquer
    // la cascade) — jamais envoyé tel quel à l'API, voir handleSubmit.
    travailleASenlis: false, travailleQuartier: '', travailType: '',
    // S5R-01 : on reprend la saisie laissée dans cet onglet (sans les
    // mots de passe) — plus besoin de tout retaper après une erreur
    ...loadRegisterDraft(),
  });

  // Chaque modification met le brouillon à jour
  useEffect(() => { saveRegisterDraft(form); }, [form]);

  // ── Règles de chaque champ (S5R-02) ─────────────────────
  // Les champs conditionnels (quartier, travail) n'ont de règle que
  // lorsqu'ils sont AFFICHÉS : un champ caché ne peut pas être fautif.
  const validation = useFieldValidation('register', {
    pseudo: (value) => validatePseudo(value),
    email: (value) => validateEmail(value),
    password: (value) => validateNewPassword(value),
    passwordConfirm: (value, all) => validatePasswordConfirm(value, all.password),
    situation: required('Choisissez votre situation'),
    quartier: (value, all) => (all.situation === 'AUTRE_QUARTIER' && !value ? 'Choisissez votre quartier' : null),
    // Recette : « je travaille à Senlis » coché → quartier ET rôle obligatoires
    travailleQuartier: (value, all) => (all.travailleASenlis && !value ? 'Choisissez le quartier où vous travaillez' : null),
    travailType: (value, all) => (all.travailleASenlis && !value ? 'Précisez si vous dirigez cette activité ou si vous y êtes salarié·e' : null),
    consent: (value) => (value ? null : 'Merci de confirmer avoir pris connaissance de la politique de confidentialité'),
  });
  const { errors, errorId, fieldProps } = validation;

  // Erreur qui ne concerne AUCUN champ (réseau, serveur…) → en haut
  const [error, setError] = useState(null);
  const formRef = useRef(null);

  // Codes d'erreur de l'API → champ concerné
  const FIELD_BY_CODE = { EMAIL_TAKEN: 'email', PSEUDO_TAKEN: 'pseudo' };
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  // S5R-01 : « adresse déjà utilisée » → c'est souvent la personne
  // elle-même, revenue après un lien de vérification perdu
  const [emailTaken, setEmailTaken] = useState(false);

  /** Met à jour un champ, puis le revérifie s'il était en erreur */
  const updateField = (name, value, extra = {}) => {
    const next = { ...form, [name]: value, ...extra };
    setForm(next);
    setError(null);
    if (name === 'email') setEmailTaken(false);
    validation.revalidateIfInvalid(name, next);
    // Corriger le mot de passe peut rendre la confirmation juste (ou fausse)
    if (name === 'password' && next.passwordConfirm) validation.revalidateIfInvalid('passwordConfirm', next);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Le quartier précédemment choisi n'a plus de sens si on quitte
    // "autre quartier" — sans ce reset, une valeur périmée resterait
    // en mémoire et partirait quand même vers l'API.
    updateField(name, value, name === 'situation' && value !== 'AUTRE_QUARTIER' ? { quartier: '' } : {});
  };

  const handleTravailleToggle = (e) => {
    const checked = e.target.checked;
    // Même logique que le reset de quartier ci-dessus : une valeur
    // périmée ne doit jamais survivre au décochage de la case.
    updateField('travailleASenlis', checked, !checked ? { travailleQuartier: '', travailType: '' } : {});
    if (!checked) {
      validation.setFieldError('travailleQuartier', null);
      validation.setFieldError('travailType', null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Tous les champs d'un coup : la personne voit TOUT ce qui reste à
    // corriger, pas une erreur à la fois (soumettre, corriger, soumettre…)
    const invalid = validation.validateAll(form);
    if (invalid.length > 0) {
      setError(invalid.length === 1
        ? 'Un champ est à corriger.'
        : `${invalid.length} champs sont à corriger.`);
      focusField(formRef.current, invalid[0]);
      return;
    }

    setLoading(true);

    try {
      // passwordConfirm, consent et travailleASenlis n'existent que
      // pour ce formulaire — quartier/travailleQuartier/travailType
      // ne sont envoyés que s'ils sont vraiment renseignés (Zod
      // refuserait une chaîne vide comme valeur d'enum).
      const {
        passwordConfirm, consent, quartier, travailleASenlis, travailleQuartier, travailType, ...rest
      } = form;
      void passwordConfirm;
      void consent;
      void travailleASenlis;
      const payload = {
        ...rest,
        ...(quartier && { quartier }),
        ...(travailleQuartier && { travailleQuartier }),
        ...(travailType && { travailType }),
      };
      const data = await register(payload);
      clearRegisterDraft();
      setSuccess(data.message);
    } catch (err) {
      // Erreur liée à un champ (Zod : details = { nomDuChamp: message } ;
      // ou un code connu comme EMAIL_TAKEN) → affichée SOUS ce champ.
      const [field, message] = err.details
        ? Object.entries(err.details)[0]
        : [FIELD_BY_CODE[err.code], err.message];
      if (field) {
        validation.setFieldError(field, message);
        focusField(formRef.current, field);
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
      setEmailTaken(err.code === 'EMAIL_TAKEN');
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
        <div style={{ background: '#fff', borderRadius: 20, padding: '8px 24px 20px', marginTop: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
          <ResendVerification defaultEmail={form.email} intro="Rien reçu après quelques minutes ? Vérifiez vos indésirables, ou recevez un nouveau lien :" />
        </div>
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

      <FormError id="register-error">{error}</FormError>
      {emailTaken && (
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px 24px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
          <p style={{ fontSize: 15 }}>
            C'est votre adresse ? <Link to="/connexion">Connectez-vous</Link>, ou, si vous n'avez
            jamais pu confirmer votre inscription :
          </p>
          <ResendVerification defaultEmail={form.email} />
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} noValidate style={{
        background: '#fff', borderRadius: 24, padding: 28,
        boxShadow: '0 2px 8px rgba(38,51,58,.06)',
      }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Pseudo</span>
            <input
              type="text" name="pseudo" value={form.pseudo} onChange={handleChange}
              autoComplete="username" required minLength={2} maxLength={30}
              placeholder="Votre pseudo public"
              {...fieldProps('pseudo', form)}
              style={inputStyle}
            />
          </label>
          <FieldError id={errorId('pseudo')}>{errors.pseudo}</FieldError>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Email</span>
            <input
              type="email" name="email" value={form.email} onChange={handleChange}
              autoComplete="email" required
              placeholder="votreadresse@email.fr"
              {...fieldProps('email', form)}
              style={inputStyle}
            />
          </label>
          <FieldError id={errorId('email')}>{errors.email}</FieldError>
          <EmailSuggestion email={form.email} hidden={Boolean(errors.email)} onAccept={(corrected) => updateField('email', corrected)} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Mot de passe</span>
            <PasswordInput
              name="password" value={form.password} onChange={handleChange}
              autoComplete="new-password" required minLength={12}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
              title="Au moins 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial"
              placeholder="12 caractères minimum"
              {...fieldProps('password', form)}
              style={inputStyle}
            />
          </label>
          <FieldError id={errorId('password')}>{errors.password}</FieldError>
        </div>
        <PasswordStrengthMeter password={form.password} />

        <div style={{ margin: '16px 0 24px' }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Confirmer le mot de passe</span>
            <PasswordInput
              name="passwordConfirm" value={form.passwordConfirm} onChange={handleChange}
              autoComplete="new-password" required
              placeholder="Retapez le même mot de passe"
              {...fieldProps('passwordConfirm', form)}
              style={inputStyle}
            />
          </label>
          <FieldError id={errorId('passwordConfirm')}>{errors.passwordConfirm}</FieldError>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Votre situation</span>
            <select
              name="situation" value={form.situation} onChange={handleChange}
              required style={inputStyle} {...fieldProps('situation', form)}
            >
              <option value="" disabled>Choisissez votre situation</option>
              <option value="CENTRE_RESIDENT">J&apos;habite le centre historique</option>
              <option value="AUTRE_QUARTIER">J&apos;habite un autre quartier de Senlis</option>
              <option value="HORS_SENLIS">Je ne réside pas à Senlis</option>
            </select>
            <p style={{ fontSize: 13, color: '#6B6257', marginTop: 4 }}>
              Sert à cibler certaines enquêtes (ex. stationnement centre-ville) — jamais vérifié, modifiable à tout moment dans Mon compte.
            </p>
          </label>
          <FieldError id={errorId('situation')}>{errors.situation}</FieldError>
        </div>

        {/* Menu en cascade : affiché seulement pour "autre quartier",
            pour que ces citoyens précisent lequel plutôt que de rester
            dans une case fourre-tout — utile pour cibler de futures
            enquêtes/propositions par quartier. */}
        {form.situation === 'AUTRE_QUARTIER' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Quel quartier ?</span>
              <select
                name="quartier" value={form.quartier} onChange={handleChange}
                required style={inputStyle} {...fieldProps('quartier', form)}
              >
                <option value="" disabled>Choisissez votre quartier</option>
                {QUARTIER_OPTIONS.map((q) => (
                  <option key={q.value} value={q.value}>{q.label}</option>
                ))}
              </select>
            </label>
            <FieldError id={errorId('quartier')}>{errors.quartier}</FieldError>
          </div>
        )}

        {/* Axe indépendant de la situation ci-dessus : on peut
            résider n'importe où et travailler à Senlis, ou l'inverse.
            Jamais obligatoire — beaucoup de comptes n'ont simplement
            aucun lien professionnel avec Senlis. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 15 }}>
          <input
            type="checkbox" checked={form.travailleASenlis}
            onChange={handleTravailleToggle}
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
          <span>Je travaille ou dirige une activité à Senlis</span>
        </label>

        {form.travailleASenlis && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Dans quel quartier ?</span>
                <select
                  name="travailleQuartier" value={form.travailleQuartier} onChange={handleChange}
                  required style={inputStyle} {...fieldProps('travailleQuartier', form)}
                >
                  <option value="" disabled>Choisissez le quartier</option>
                  {TRAVAIL_QUARTIER_OPTIONS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </label>
              <FieldError id={errorId('travailleQuartier')}>{errors.travailleQuartier}</FieldError>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>À ce titre...</span>
                <select
                  name="travailType" value={form.travailType} onChange={handleChange}
                  required style={inputStyle} {...fieldProps('travailType', form)}
                >
                  <option value="" disabled>Précisez</option>
                  {TRAVAIL_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <FieldError id={errorId('travailType')}>{errors.travailType}</FieldError>
            </div>
          </>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#26333A' }}>
            <input
              type="checkbox" name="consent" checked={form.consent}
              onChange={(e) => updateField('consent', e.target.checked)}
              {...fieldProps('consent', form)}
              required style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }}
            />
            <span>
              J'ai pris connaissance de la{' '}
              {/* Nouvel onglet : le formulaire à moitié rempli n'est pas perdu.
                  Il faut alors le DIRE (RGAA 13.2) — texte réservé aux lecteurs
                  d'écran — et couper le lien avec la page d'origine (rel). */}
              <Link to="/confidentialite" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                politique de confidentialité
                <span className="sr-only"> (s'ouvre dans un nouvel onglet)</span>
              </Link>
            </span>
          </label>
          <FieldError id={errorId('consent')}>{errors.consent}</FieldError>
        </div>

        <button
          type="submit" disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? 'Création en cours…' : 'Créer mon compte'}
        </button>
      </form>

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
