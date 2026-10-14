import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PATH_PERMS, hasPerm } from '../utils/pagePermissions';

export const ProtectedRoute = ({ children, allowedRoles = [], perm }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const required = perm || PATH_PERMS[location.pathname];
  const allowed = required
    ? hasPerm(user, required)
    : (allowedRoles.length === 0 || allowedRoles.includes(user.role));

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="access-denied">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};
