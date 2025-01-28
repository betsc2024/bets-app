import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/supabase';

const AdminRouteGuard = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const location = useLocation();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Get user role
      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Only allow access if user is an admin
      setHasAccess(userData?.role === 'admin' || userData?.role === 'super_admin');
      setLoading(false);
    } catch (error) {
      console.error('Error checking admin access:', error);
      setHasAccess(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!hasAccess) {
    // Redirect to user route if not an admin
    return <Navigate to="/user" state={{ from: location }} replace />;
  }

  return children;
};

export default AdminRouteGuard;
