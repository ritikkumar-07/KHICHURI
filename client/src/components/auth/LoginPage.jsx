import { useState } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { authConfigured, supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../services/api';

export function LoginPage({ initialMode = null, onSuccess, onCancel }) {
  const { signUp, signIn } = useAuth() || {};
  const [mode, setMode] = useState(initialMode);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    if (!authConfigured) { setMessage('Supabase authentication is not configured.'); setBusy(false); return; }
    const result = creating
      ? (signUp ? await signUp(email, password, { full_name: name }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } }))
      : (signIn ? await signIn(email, password) : await supabase.auth.signInWithPassword({ email, password }));
    if (result.error) { setMessage(result.error.message); setBusy(false); return; }
    if (creating && !result.data.session) { setMessage('Account created. Check your email to confirm it, then sign in.'); setCreating(false); setBusy(false); return; }
    const user = result.data.user;
    if (mode === 'admin' && user?.app_metadata?.role !== 'hospital_admin') {
      await supabase.auth.signOut();
      setMessage('This account is not authorized as a hospital administrator.');
      setBusy(false); return;
    }
    if (mode === 'admin') {
      try { await api.admin.me(); }
      catch (error) {
        await supabase.auth.signOut();
        setMessage(error.response?.data?.message || 'Hospital administrator access could not be verified.');
        setBusy(false); return;
      }
    }
    onSuccess(mode, user); setBusy(false);
  };
  if (!mode) return <section className="auth-card"><span className="section-kicker">SECURE ACCESS</span><h1>Sign in to Sanjeevani</h1><p>Choose the portal that matches your account.</p><div className="auth-choice"><button onClick={() => setMode('user')}><UserRound /><b>User / Patient</b><small>Personal health and reminders</small></button><button onClick={() => setMode('admin')}><Building2 /><b>Hospital Admin</b><small>Authorized hospital accounts only</small></button></div><button className="text-button" onClick={onCancel}>Back to Dashboard</button></section>;
  return (
    <section className="auth-card">
      <span className="section-kicker">{mode === 'admin' ? 'AUTHORIZED HOSPITAL ACCESS' : 'PERSONAL HEALTH ACCESS'}</span>
      <h1>{mode === 'admin' ? 'Hospital Admin' : creating ? 'Create your account' : 'Welcome back'}</h1>
      <form onSubmit={submit}>
        {creating && (
          <label>
            Full Name
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Enter your full name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            minLength="6"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </label>
        {message && <div className="auth-message" role="alert">{message}</div>}
        <button className="button primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'admin' ? 'Admin Sign In' : creating ? 'Create Account' : 'Sign In'}
        </button>
      </form>
      {mode === 'user' && (
        <button
          className="text-button"
          onClick={() => {
            setCreating(!creating);
            setMessage('');
            setName('');
          }}
        >
          {creating ? 'Already have an account? Sign In' : "Don't have an account? Create Account"}
        </button>
      )}
      <button
        className="text-button"
        onClick={() => {
          setMode(null);
          setCreating(false);
          setMessage('');
          setName('');
        }}
      >
        Back to login options
      </button>
    </section>
  );
}

