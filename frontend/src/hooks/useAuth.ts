import { useAuthStore } from '@/store/auth';

export function useAuth() {
  const { user, accessToken, refreshToken, setSession, updateUser, logout } = useAuthStore();

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: Boolean(user && accessToken),
    setSession,
    updateUser,
    logout,
  };
}
