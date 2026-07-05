import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('+2250700000002');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [debugCode, setDebugCode] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post('/auth/request-otp', { phone });
      setStep('code');
      // In local dev the backend returns the code for convenience.
      if (res.debug_code) setDebugCode(res.debug_code);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post('/auth/verify-otp', { phone, code });
      await login(res.token);
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <h1>Connexion</h1>
      {error && <p className="error">{error}</p>}

      {step === 'phone' ? (
        <form onSubmit={requestOtp}>
          <label>Numéro de téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225…" />
          <button className="primary" disabled={busy}>Recevoir le code</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label>Code reçu par SMS</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 chiffres" />
          {debugCode && <p className="muted small">Code (dev) : <code>{debugCode}</code></p>}
          <button className="primary" disabled={busy}>Se connecter</button>
        </form>
      )}
    </section>
  );
}
