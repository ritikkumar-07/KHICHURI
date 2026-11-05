import { useState, useCallback } from 'react';
import { Building2, UserRound, Mail, Lock, Eye, EyeOff, ArrowLeft, ChevronRight } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'error' }); // type: 'error' | 'info'
  const [errors, setErrors] = useState({ email: '', password: '', name: '' });

  const isAdmin = mode === 'admin';
  const isSignUp = creating;

  const setFieldError = useCallback((field, text) => {
    setErrors(prev => ({ ...prev, [field]: text }));
  }, []);

  const clearMessage = () => setMessage({ text: '', type: 'error' });

  const validate = () => {
    const next = { email: '', password: '', name: '' };
    let valid = true;

    const emailTrim = email.trim();
    if (!emailTrim) {
      next.email = 'Email is required.';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      next.email = 'Please enter a valid email address.';
      valid = false;
    }

    if (!password) {
      next.password = 'Password is required.';
      valid = false;
    } else if (isSignUp && password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
      valid = false;
    }

    if (isSignUp) {
      const nameTrim = name.trim();
      if (!nameTrim) {
        next.name = 'Full name is required.';
        valid = false;
      } else if (nameTrim.length < 2) {
        next.name = 'Please enter your full name.';
        valid = false;
      }
    }

    setErrors(next);
    return valid;
  };

  const showMessage = (text, type = 'error') => {
    setMessage({ text, type });
  };

  const handleSubmit = async event => {
    event.preventDefault();
    clearMessage();
    if (!validate()) return;
    setBusy(true);

    if (!authConfigured) {
      showMessage('Supabase authentication is not configured.', 'error');
      setBusy(false);
      return;
    }

    let result;
    try {
      result = isSignUp
        ? (signUp
          ? await signUp(email, password, { full_name: name, role: isAdmin ? 'hospital_admin' : 'user' })
          : await supabase.auth.signUp({ email, password, options: { data: { full_name: name, role: isAdmin ? 'hospital_admin' : 'user' } } }))
        : (signIn
          ? await signIn(email, password)
          : await supabase.auth.signInWithPassword({ email, password }));
    } catch (err) {
      showMessage(err?.message || 'Something went wrong. Please try again.', 'error');
      setBusy(false);
      return;
    }

    if (result.error) {
      showMessage(result.error.message, 'error');
      setBusy(false);
      return;
    }

    if (isSignUp && !result.data.session) {
      showMessage('Account created. Check your email to confirm it, then sign in.', 'info');
      setCreating(false);
      setName('');
      setPassword('');
      setBusy(false);
      return;
    }

    const user = result.data.user;
    const userRole = user?.app_metadata?.role;

    if (isAdmin && userRole !== 'hospital_admin') {
      await supabase.auth.signOut();
      showMessage('This account is not authorized as a hospital administrator.', 'error');
      setBusy(false);
      return;
    }

    if (isAdmin) {
      try {
        await api.admin.me();
      } catch (error) {
        await supabase.auth.signOut();
        showMessage(error.response?.data?.message || 'Hospital administrator access could not be verified.', 'error');
        setBusy(false);
        return;
      }
    }

    onSuccess(mode, user);
    setBusy(false);
  };

  const handleSignUpToggle = () => {
    setCreating(prev => !prev);
    setMessage({ text: '', type: 'error' });
    setName('');
    setEmail('');
    setPassword('');
    setErrors({ email: '', password: '', name: '' });
  };

  const handleBackToOptions = () => {
    setMode(null);
    setCreating(false);
    setMessage({ text: '', type: 'error' });
    setName('');
    setEmail('');
    setPassword('');
    setErrors({ email: '', password: '', name: '' });
  };

  const modeTitle = isSignUp ? 'Create your account' : isAdmin ? 'Admin Sign In' : 'Welcome back';
  const modeKicker = isAdmin ? 'AUTHORIZED HOSPITAL ACCESS' : 'PERSONAL HEALTH ACCESS';
  const actionLabel = isAdmin ? 'Admin Sign In' : isSignUp ? 'Create Account' : 'Sign In';

  // ------------------------------------------------------------------
  // State: Choose account type (no mode selected yet)
  // ------------------------------------------------------------------
  if (!mode) {
    return (
      <section className="auth-page">
        <div className="auth-wrapper">
          <div className="auth-card">
            <span className="section-kicker">SECURE ACCESS</span>
            <h1>Sign in to Sanjeevani</h1>
            <p className="auth-subtitle">Choose the portal that matches your account.</p>
            <div className="auth-choice">
              <button
                type="button"
                onClick={() => setMode('user')}
                aria-label="User / Patient portal"
              >
                <span className="choice-icon"><UserRound size={20} /></span>
                <b>User / Patient</b>
                <small>Personal health records and reminders</small>
              </button>
              <button
                type="button"
                onClick={() => setMode('admin')}
                aria-label="Hospital Admin portal"
              >
                <span className="choice-icon"><Building2 size={20} /></span>
                <b>Hospital Admin</b>
                <small>Authorized hospital accounts only</small>
              </button>
            </div>
            <button
              type="button"
              className="text-button app-back-button"
              onClick={onCancel}
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------
  // State: Sign In / Sign Up form
  // ------------------------------------------------------------------
  return (
    <section className="auth-page">
      <div className="auth-wrapper">
        <div className="auth-card">
          <button
            type="button"
            className="auth-back-link"
            onClick={handleBackToOptions}
            aria-label="Back to login options"
          >
            <ArrowLeft size={14} /> Back to login options
          </button>

          <span className="section-kicker">{modeKicker}</span>
          <h1>{modeTitle}</h1>
          <p className="auth-subtitle">
            {isSignUp
              ? 'Join Sanjeevani to manage your health and emergency profile.'
              : 'Enter your credentials below to access your account.'}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {isSignUp && (
              <div className="auth-field">
                <label htmlFor="auth-name">Full Name</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <UserRound size={16} />
                  </span>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={e => { setName(e.target.value); setFieldError('name', ''); }}
                    placeholder="Enter your full name"
                    className={`auth-input${errors.name ? ' error' : ''}`}
                    disabled={busy}
                  />
                </div>
                {errors.name && <span className="auth-field-error">{errors.name}</span>}
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Mail size={16} />
                  </span>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFieldError('email', ''); }}
                  placeholder="you@clinic.in"
                  className={`auth-input${errors.email ? ' error' : ''}`}
                  disabled={busy}
                />
              </div>
              {errors.email && <span className="auth-field-error">{errors.email}</span>}
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <Lock size={16} />
                  </span>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  minLength="6"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setFieldError('password', ''); }}
                  placeholder="••••••••"
                  className={`auth-input${errors.password ? ' error' : ''}`}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <span className="auth-field-error">{errors.password}</span>}
            </div>

            {message.text && (
              <div className={`auth-message ${message.type}`} role="alert">
                {message.text}
              </div>
            )}

            <button
              type="submit"
              className="auth-button primary"
              disabled={busy}
            >
              {busy ? (
                <span className="auth-spinner" />
              ) : (
                actionLabel
              )}
              {!busy && <ChevronRight size={16} />}
            </button>
          </form>

          <div className="auth-divider">
            {isSignUp ? 'Already have an account?' : 'New to Sanjeevani?'}
          </div>

          <button
            type="button"
            className="auth-text-button"
            onClick={handleSignUpToggle}
          >
            {isSignUp ? 'Sign in to your account' : "Don't have an account? Create Account"}
          </button>

          <div className="auth-footer">
            Not a hospital admin?{' '}
            {isAdmin ? (
              <a href="#" onClick={e => { e.preventDefault(); setMode('user'); }} onMouseDown={e => e.preventDefault()}>
                Switch to patient portal
              </a>
            ) : (
              <a href="#" onClick={e => { e.preventDefault(); setMode('admin'); }} onMouseDown={e => e.preventDefault()}>
                Hospital administrator login
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
