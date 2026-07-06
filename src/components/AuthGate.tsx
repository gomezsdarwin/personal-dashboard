import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { accentDefault } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
};

/** Backdrop gradient stops behind the sign-in card, theme-aware since this screen
 * renders before/without the painted AppShell background. */
const BACKDROP = {
  light: ['#ffe9f5', '#ece7ff', '#e0f3ff'] as [string, string, string],
  dark: ['#0d0c16', '#131020', '#0c1522'] as [string, string, string],
};

/**
 * If Supabase is configured and there's no active session, shows a minimal glass
 * email/password sign-in (with sign-up). Otherwise renders children directly —
 * either because the user is authenticated, or because the app is running in
 * local AsyncStorage-only mode (no Supabase env vars set).
 */
export function AuthGate({ children }: Props) {
  const { palette, glass, mode } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(isSupabaseConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode2, setMode2] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setCheckingSession(false);
      })
      .catch(() => {
        // Session check failed (e.g. offline at launch) — don't strand the user
        // on the spinner; fall through to the sign-in form.
        setCheckingSession(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (checkingSession) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color={palette.accentText} />
      </View>
    );
  }

  if (session) {
    return <>{children}</>;
  }

  const onSubmit = async () => {
    if (!supabase) return;
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    setSubmitting(true);
    if (mode2 === 'sign-in') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setSubmitting(false);
      if (authError) setError(authError.message);
    } else {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      setSubmitting(false);
      if (authError) {
        setError(authError.message);
      } else if (!data.session) {
        // Email confirmation required — no session yet. Tell the user instead of
        // leaving them on a silent form.
        setNotice('Check your email to confirm your account, then sign in.');
        setMode2('sign-in');
      }
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={BACKDROP[mode]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.centerFill}>
        <GlassCard style={styles.card}>
          <Text style={[styles.title, { color: palette.text.primary }]}>Personal Dashboard</Text>
          <Text style={[styles.subtitle, { color: palette.text.secondary }]}>
            {mode2 === 'sign-in' ? 'Sign in to continue' : 'Create an account'}
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={palette.text.quaternary}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[
              styles.input,
              { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primary },
            ]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={palette.text.quaternary}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primary },
            ]}
          />

          {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
          {notice ? <Text style={[styles.notice, { color: palette.warning }]}>{notice}</Text> : null}

          <Pressable onPress={onSubmit} disabled={submitting} style={styles.submitWrapper}>
            <LinearGradient
              colors={accentDefault}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.87, y: 1 }}
              style={styles.submit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {mode2 === 'sign-in' ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => setMode2(mode2 === 'sign-in' ? 'sign-up' : 'sign-in')}>
            <Text style={[styles.switchMode, { color: palette.text.secondary }]}>
              {mode2 === 'sign-in'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  error: {
    fontSize: 13,
    marginBottom: 8,
  },
  notice: {
    fontSize: 13,
    marginBottom: 8,
  },
  submitWrapper: {
    marginTop: 6,
  },
  submit: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchMode: {
    marginTop: 14,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default AuthGate;
