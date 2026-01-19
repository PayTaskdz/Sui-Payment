import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { getChallenge, getProfile, postVerify, WalletChallengeResponseDto } from '@/services/api';

type AuthUser = unknown;

type AuthContextValue = {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  user: AuthUser | null;
  token: string | null;
  loginWithWallet: () => Promise<{ needsOnboarding: boolean }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'jwt_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount();
  const signPersonalMessage = useSignPersonalMessage();

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const isLoginInFlightRef = useRef(false);

  const isAuthenticated = useMemo(() => Boolean(token), [token]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setIsAuthLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!t) {
      setToken(null);
      setUser(null);
      return;
    }

    const res = await getProfile();
    setToken(t);
    setUser(res.data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsAuthLoading(true);
      try {
        const t = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!t) {
          if (cancelled) return;
          setToken(null);
          setUser(null);
          return;
        }

        const res = await getProfile();
        if (cancelled) return;
        setToken(t);
        setUser(res.data);
      } catch {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setUser(null);
      } finally {
        if (cancelled) return;
        setIsAuthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithWallet = useCallback(async (): Promise<{ needsOnboarding: boolean }> => {
    if (!account?.address) {
      throw new Error('No wallet connected');
    }

    if (isLoginInFlightRef.current) {
      return { needsOnboarding: false };
    }

    isLoginInFlightRef.current = true;
    setIsAuthLoading(true);

    try {
      const challengeRes = await getChallenge(account.address);
      const challenge: WalletChallengeResponseDto = challengeRes.data;

      const issuedAt = new Date().toISOString();
      const expirationTime = challenge.expiresAt;

      const message = `Sign in to ${challenge.domain}\n\nAddress: ${account.address}\nNonce: ${challenge.nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}`;

      const messageBytes = new TextEncoder().encode(message);
      const sigRes = await signPersonalMessage.mutateAsync({ message: messageBytes });

      const verifyRes = await postVerify({
        address: account.address,
        domain: challenge.domain,
        nonce: challenge.nonce,
        issuedAt,
        expirationTime,
        message,
        signature: sigRes.signature,
      });

      const data = verifyRes.data as unknown as {
        accessToken?: unknown;
        token?: unknown;
        needsOnboarding?: unknown;
      };
      const accessToken =
        typeof data?.accessToken === 'string' ? data.accessToken : typeof data?.token === 'string' ? data.token : null;
      if (!accessToken) {
        throw new Error('Auth succeeded but no token returned from backend');
      }

      const needsOnboarding = Boolean(data?.needsOnboarding);

      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      setToken(accessToken);

      if (!needsOnboarding) {
        try {
          await refreshProfile();
        } catch {
          logout();
        }
      }

      return { needsOnboarding };
    } finally {
      isLoginInFlightRef.current = false;
      setIsAuthLoading(false);
    }
  }, [account?.address, logout, refreshProfile, signPersonalMessage]);

  const value: AuthContextValue = useMemo(
    () => ({
      isAuthenticated,
      isAuthLoading,
      user,
      token,
      loginWithWallet,
      logout,
      refreshProfile,
    }),
    [isAuthenticated, isAuthLoading, loginWithWallet, logout, refreshProfile, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

