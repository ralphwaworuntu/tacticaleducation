import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type ProtectedRouteProps = {
  roles?: Array<'ADMIN' | 'MEMBER'>;
};

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (user?.role === 'MEMBER' && user.isEmailVerified === false) {
    return <Navigate to="/auth/verify" state={{ email: user.email }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    const fallback = user.role === 'ADMIN' ? '/admin' : '/app';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
