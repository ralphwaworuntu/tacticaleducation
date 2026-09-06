import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MembershipStatus = {
  isActive: boolean;
  expiresAt?: string | null;
  packageName?: string | null;
  transactionCode?: string | null;
  allowTryout?: boolean;
  allowPractice?: boolean;
  allowCermat?: boolean;
};

export type MemberArea = {
  slug: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  referralCode: string;
  isEmailVerified: boolean;
  avatarUrl?: string | null;
  phone?: string | null;
  memberArea?: MemberArea | null;
  membership?: MembershipStatus;
};

type AuthPayload = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type AuthState = {
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  setSession: (payload: AuthPayload) => void;
  updateUser: (payload: Partial<AuthUser>) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: undefined,
      accessToken: undefined,
      refreshToken: undefined,
      setSession: (payload) => set({ ...payload }),
      updateUser: (payload) =>
        set((state) => ({
          ...state,
          user: state.user ? { ...state.user, ...payload } : state.user,
        })),
      logout: () => set({ user: undefined, accessToken: undefined, refreshToken: undefined }),
    }),
    {
      name: 'tactical-education-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);

export const authStore = {
  getState: () => useAuthStore.getState(),
  setSession: (payload: AuthPayload) => useAuthStore.getState().setSession(payload),
  updateUser: (payload: Partial<AuthUser>) => useAuthStore.getState().updateUser(payload),
  logout: () => useAuthStore.getState().logout(),
};
