import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data?.session ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('Supabase auth session load warning:', err);
        setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data?.subscription?.unsubscribe();
  }, []);

  const signUp = async (email, password, metadata = {}) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
  };

  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    if (!supabase) return;
    return supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      loading,
      isHospitalAdmin: session?.user?.app_metadata?.role === 'hospital_admin',
      signUp,
      signIn,
      signOut,
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
