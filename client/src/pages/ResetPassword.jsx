import { useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';
import Mascot from '../components/Mascot/Mascot.jsx';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter/PasswordStrengthMeter.jsx';
import { usePageTitle } from '../hooks/usePageTitle.js';
import FieldError from '../components/FieldError/FieldError.jsx';
import PasswordInput from '../components/PasswordInput/PasswordInput.jsx';
import { useFieldValidation, focusField } from '../hooks/useFieldValidation.js';
import { validateNewPassword, validatePasswordConfirm } from '../utils/formValidation.js';

export default function ResetPassword() {
  usePageTitle('Nouveau mot de passe');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState(token ? 'form' : 'error');
  const [message, setMessage] = useState(token ? '' : 'Lien invalide — jeton manquant.');
  const [loading, setLoading] = useState(false);
  // S5R-02 : erreurs sous chaque champ, vérifiées en quittant le champ
  const formRef = useRef(null);
  const validation = useFieldValidation('reset', {
    password: (value) => validateNewPassword(value),
    passwordConfirm: (value, all) => validatePasswordConfirm(value, all.password),
  });
  const values = { password, passwordConfirm };

  const updatePassword = (value) => {
    setPassword(value);
    const next = { password: value, passwordConfirm };
    validation.revalidateIfInvalid('password', next);
    if (passwordConfirm) validation.revalidateIfInvalid('passwordConfirm', next);
  };
  const updateConfirm = (value) => {
    setPasswordConfirm(value);
    validation.revalidateIfInvalid('passwordConfirm', { password, passwordConfirm: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const invalid = validation.validateAll(values);
    if (invalid.length > 0) {
      focusField(formRef.current, invalid[0]);
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const data = await api.post('/auth/reset-password', { token, password });
      setStatus('success');
      setMessage(data.message);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') {
        // Mot de passe refusé par l'API : on RESTE sur le formulaire,
        // avec le message sous le champ concerné
        validation.setFieldError('password', err.details ? Object.values(err.details)[0] : err.message);
        focusField(formRef.current, 'password');
      } else {
        setStatus('error');
        setMessage(err.message || 'Jeton invalide ou expiré.');
      }
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
      <form ref={formRef} onSubmit={handleSubmit} noValidate style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 2px 8px rgba(38,51,58,.06)' }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Nouveau mot de passe</span>
            <PasswordInput name="password" value={password} onChange={(e) => updatePassword(e.target.value)}
              autoComplete="new-password" required minLength={12}
              placeholder="12 caractères minimum"
              {...validation.fieldProps('password', values)}
              style={fieldStyle} />
          </label>
          <FieldError id={validation.errorId('password')}>{validation.errors.password}</FieldError>
        </div>
        <PasswordStrengthMeter password={password} />

        <div style={{ margin: '16px 0 20px' }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>Confirmer le mot de passe</span>
            <PasswordInput name="passwordConfirm" value={passwordConfirm} onChange={(e) => updateConfirm(e.target.value)}
              autoComplete="new-password" required placeholder="Retapez le même mot de passe"
              {...validation.fieldProps('passwordConfirm', values)}
              style={fieldStyle} />
          </label>
          <FieldError id={validation.errorId('passwordConfirm')}>{validation.errors.passwordConfirm}</FieldError>
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? 'Réinitialisation…' : 'Réinitialiser'}
        </button>
      </form>
    </div>
  );
}

const fieldStyle = { width: '100%', padding: '12px 16px', fontSize: 17, border: '2px solid #e3dcce', borderRadius: 12, fontFamily: "'Public Sans', system-ui" };
