// ══════════════════════════════════════════════════════════
// Rappel annuel de changer de mot de passe — équipe seulement (S5R-13b)
//
// La CNIL recommande de renouveler régulièrement les mots de passe
// des comptes d'ADMINISTRATION (pas ceux des citoyens : le NIST le
// déconseille, et on le suit pour eux — document 21, § 8.5). L'API
// indique `passwordRenewalDue` quand le mot de passe d'un compte
// admin ou Admin-test a plus d'un an.
//
// Un rappel, jamais un blocage : le bandeau reste jusqu'au changement.
//
// Analogie : l'autocollant « prochaine vidange » sur le pare-brise —
// la voiture roule encore, mais on sait qu'il est temps.
//
// Ne rend rien si le rappel n'est pas dû : on peut le placer sans
// condition en haut des pages de gestion.
// ══════════════════════════════════════════════════════════

import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function PasswordRenewalBanner() {
  const { user } = useAuth();
  if (!user?.passwordRenewalDue) return null;
  return (
    <p role="note" style={{
      background: '#FBF1DC', border: '2px solid #C97A2E', borderRadius: 12,
      padding: '10px 14px', fontSize: 15, margin: '0 0 20px', color: '#26333A',
    }}>
      <span aria-hidden="true">🔑 </span>
      <strong>Votre mot de passe a plus d'un an.</strong> Pour un compte d'administration, la CNIL
      recommande de le changer régulièrement.{' '}
      <Link to="/mon-compte#mot-de-passe">Changer mon mot de passe</Link>
    </p>
  );
}
