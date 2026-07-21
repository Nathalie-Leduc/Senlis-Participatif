// ══════════════════════════════════════════════════════════
// Header — barre de navigation avec état auth
// ══════════════════════════════════════════════════════════

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function Header() {
  const { isLogged, isAdmin, user, logout } = useAuth();
  const { pathname } = useLocation();

  // "/" doit être une correspondance EXACTE (sinon elle matcherait
  // TOUJOURS, puisque tout chemin commence par "/"). Les autres
  // acceptent aussi leurs sous-pages (ex. /admin/propositions/nouvelle
  // doit garder "Admin" actif dans la nav).
  const isActive = (path) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <header style={{
      background: '#fff',
      borderBottom: '2px solid #FFF4DB',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div className="wrap" style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 0', gap: 10, flexWrap: 'wrap',
      }}>
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: "'Fraunces', Georgia, serif",
          fontWeight: 700, fontSize: 19, textDecoration: 'none',
          color: '#26333A',
        }}>
          🦌 Senlis Participatif
        </Link>

        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <NavBtn to="/" active={isActive('/')}>Accueil</NavBtn>
          <NavBtn to="/propositions" active={isActive('/propositions')}>Propositions</NavBtn>
          <NavBtn to="/enquetes" active={isActive('/enquetes')}>Enquêtes</NavBtn>
          {isAdmin && (
            <>
              <NavBtn to="/admin/propositions" active={isActive('/admin/propositions')}>
                Admin propositions
              </NavBtn>
              <NavBtn to="/admin/enquetes" active={isActive('/admin/enquetes')}>
                Admin enquêtes
              </NavBtn>
            </>
          )}

          {isLogged ? (
            <>
              <NavBtn to="/mon-compte" active={isActive('/mon-compte')}>
                {user?.pseudo || 'Mon compte'}
              </NavBtn>
              <button onClick={logout} style={navBtnStyle}>Déconnexion</button>
            </>
          ) : (
            <NavBtn to="/connexion" active={isActive('/connexion')}>Connexion</NavBtn>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavBtn({ to, active, children }) {
  return (
    <Link to={to} style={{
      ...navBtnStyle,
      ...(active ? { background: '#1E5F7C', color: '#fff' } : {}),
      textDecoration: 'none',
    }}>
      {children}
    </Link>
  );
}

const navBtnStyle = {
  font: '700 15px "Public Sans", system-ui, sans-serif',
  padding: '10px 16px',
  minHeight: 44,
  border: 'none',
  background: 'none',
  borderRadius: 12,
  cursor: 'pointer',
  color: '#6B6257',
  display: 'inline-flex',
  alignItems: 'center',
};
