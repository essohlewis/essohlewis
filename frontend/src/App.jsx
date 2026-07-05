import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import TipsterProfile from './pages/TipsterProfile.jsx';
import Login from './pages/Login.jsx';
import Wallet from './pages/Wallet.jsx';

function Nav() {
  const { user, logout } = useAuth();
  return (
    <header className="nav">
      <Link to="/" className="brand">⚽ Pronos</Link>
      <nav>
        <Link to="/">Classement</Link>
        {user ? (
          <>
            <Link to="/wallet">Wallet</Link>
            <button className="link" onClick={logout}>Déconnexion</button>
          </>
        ) : (
          <Link to="/login">Connexion</Link>
        )}
      </nav>
    </header>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Chargement…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route path="/tipsters/:id" element={<TipsterProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
        </Routes>
      </main>
      <footer className="footer">
        Service d'information sportive. Jouer comporte des risques — réservé aux 18 ans et plus.
      </footer>
    </>
  );
}
