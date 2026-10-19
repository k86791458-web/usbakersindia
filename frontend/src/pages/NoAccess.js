import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function NoAccess() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen flex items-center justify-center p-6" data-testid="no-access-page">
      <div className="text-center max-w-md space-y-3">
        <h1 className="text-2xl font-bold text-red-600">No pages assigned</h1>
        <p className="text-gray-600">
          Hi {user.name}, your account has no page access yet. Please ask the super admin to tick page rights for you in Users → Permissions.
        </p>
        <Button onClick={logout} variant="outline" data-testid="no-access-logout-btn">Logout</Button>
      </div>
    </div>
  );
}
