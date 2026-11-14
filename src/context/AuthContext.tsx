import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, StaffMember } from '../types.ts';
import { api, DEMO_MODE, getToken, setToken } from '../api.ts';
import { supabase, SUPABASE_ENABLED } from '../supabase.ts';
import { ALL_PRESET_USERS, STAFF_MEMBERS } from '../data/staffMembers.ts';

export const PRESET_USERS: UserProfile[] = ALL_PRESET_USERS;
export { STAFF_MEMBERS };

interface AuthContextType {
  currentUser: UserProfile | null;
  /** Sign in with username or email, role, optional name and password/PIN */
  login: (identifier: string, role: UserRole, name?: string, secret?: string) => Promise<void>;
  quickLogin: (userId: string) => boolean;
  /** Instant switch to a staff member or member. Returns false when a treasurer PIN is required. */
  directLoginUser: (user: UserProfile | StaffMember) => boolean;
  logout: () => void;
  /** Create a MEMBER account in Supabase (officers are promoted in SQL only). */
  register: (email: string, name: string, password: string) => Promise<void>;
  /** True while a saved Supabase session is being restored. */
  loading: boolean;
  switchRole: (role: UserRole) => void;
  staffMembers: StaffMember[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('stokvel_auth_user');
    if (!saved || SUPABASE_ENABLED) return null; // Start on the login page when nothing is saved
    try {
      const user = JSON.parse(saved) as UserProfile;
      // A treasurer is only real if the backend issued a session token to this browser tab.
      if (user.role === 'treasurer' && !getToken()) return null;
      return user;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(SUPABASE_ENABLED);

  useEffect(() => {
    if (SUPABASE_ENABLED) return; // Supabase owns the session; don't mirror it into localStorage
    if (currentUser) {
      localStorage.setItem('stokvel_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('stokvel_auth_user');
    }
  }, [currentUser]);

  const loadProfile = async (uid: string, email: string): Promise<UserProfile> => {
    const { data } = await supabase!.from('profiles').select('full_name, role, wallet_address, member_code').eq('id', uid).single();
    const isOfficer = data?.role === 'treasurer';
    return {
      id: uid, email, name: data?.full_name || email, role: isOfficer ? 'treasurer' : 'user',
      memberId: uid, // the backend keys claims on this auth uid
      staffId: isOfficer ? data?.member_code : undefined, walletAddress: data?.wallet_address ?? undefined
    };
  };

  const startSession = async (s: { access_token: string; user: { id: string; email?: string } }) => {
    setToken(s.access_token);
    setCurrentUser(await loadProfile(s.user.id, s.user.email ?? ''));
  };

  // Restore a saved Supabase session and keep the API token fresh (Supabase refreshes it automatically).
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    supabase!.auth.getSession()
      .then(({ data }) => (data.session ? startSession(data.session) : undefined))
      .finally(() => setLoading(false));
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, s) => {
      setToken(s?.access_token ?? null); // keep this callback sync: awaiting supabase calls in here can deadlock
      if (!s) setCurrentUser(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const supaLogin = async (identifier: string, password: string) => {
    const id = identifier.trim().toLowerCase();
    const email = ALL_PRESET_USERS.find((u) => u.username?.toLowerCase() === id)?.email ?? identifier.trim();
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(error?.message || 'Sign-in failed.');
    await startSession(data.session);
  };

  const register = async (email: string, name: string, password: string) => {
    if (!SUPABASE_ENABLED) return login(email, 'user', name, password);
    const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name } } });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Account created. Check your email to confirm it, then sign in.');
    await startSession(data.session);
  };

  const login = async (identifier: string, role: UserRole, name?: string, secret?: string) => {
    if (SUPABASE_ENABLED) return supaLogin(identifier, secret ?? '');
    const idClean = identifier.trim().toLowerCase();

    // Look up by username, email or staff id
    const existing = ALL_PRESET_USERS.find(
      (u) =>
        u.email.toLowerCase() === idClean ||
        (u.username && u.username.toLowerCase() === idClean) ||
        (u.staffId && u.staffId.toLowerCase() === idClean)
    );

    const wantsTreasurer = role === 'treasurer' || existing?.role === 'treasurer';
    if (wantsTreasurer) {
      // Real check: the backend compares the PIN and returns a session token.
      // Nothing is granted if this throws (wrong PIN, backend down, ...).
      if (!secret || !secret.trim()) {
        throw new Error(
          DEMO_MODE ? 'Enter any password to continue (demo mode).' : 'Enter the treasurer PIN to continue.'
        );
      }
      await api.login(secret.trim(), existing?.name || name || 'Treasurer');
    } else if (getToken()) {
      await api.logout();
    }

    if (existing) {
      setCurrentUser(existing);
    } else {
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        name: name || identifier,
        email: identifier.includes('@') ? identifier : `${identifier}@stokvel.org`,
        username: identifier,
        role: wantsTreasurer ? 'treasurer' : 'user',
        memberId: wantsTreasurer ? 'TR-009' : `STK-${Math.floor(100 + Math.random() * 900)}`,
        staffId: wantsTreasurer ? 'STF-009' : undefined,
        walletAddress: `r${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      };
      setCurrentUser(newUser);
    }
  };

  /**
   * One-click switch. Members are fine. A treasurer needs a PIN-verified backend session,
   * so this returns false (and the caller shows the PIN form) unless the app is in demo mode.
   */
  const directLoginUser = (user: UserProfile | StaffMember): boolean => {
    if (SUPABASE_ENABLED) return false; // real accounts only: no one-click switching
    if (user.role === 'treasurer') {
      if (!DEMO_MODE) return false;
      setToken('demo-session');
    } else if (getToken()) {
      void api.logout();
    }
    const profile: UserProfile = {
      id: user.id,
      name: user.name,
      username: 'username' in user ? user.username : undefined,
      email: user.email,
      role: user.role,
      memberId: 'staffId' in user ? `${user.staffId} (${user.title})` : user.memberId,
      staffId: 'staffId' in user ? user.staffId : undefined,
      department: user.department,
      title: user.title,
      clearanceLevel: 'clearanceLevel' in user ? user.clearanceLevel : undefined,
      avatarUrl: user.avatarUrl,
      walletAddress: user.walletAddress,
      phone: user.phone
    };
    setCurrentUser(profile);
    return true;
  };

  const quickLogin = (userId: string): boolean => {
    const target = ALL_PRESET_USERS.find((u) => u.id === userId);
    return target ? directLoginUser(target) : false;
  };

  const logout = () => {
    if (SUPABASE_ENABLED) void supabase!.auth.signOut();
    if (getToken()) void api.logout();
    setCurrentUser(null);
  };

  const switchRole = (newRole: UserRole) => {
    const target =
      newRole === 'treasurer'
        ? ALL_PRESET_USERS.find((u) => u.role === 'treasurer')
        : ALL_PRESET_USERS.find((u) => u.role === 'user');
    if (target) directLoginUser(target);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        quickLogin,
        directLoginUser,
        logout,
        register,
        loading,
        switchRole,
        staffMembers: STAFF_MEMBERS
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
