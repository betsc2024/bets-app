import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const UserRouteGuard = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const location = useLocation();

  useEffect(() => {
    checkUserAccess();
  }, []);

  const checkUserAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        return;
      }

      // Get user role and company_id
      const { data: userData, error } = await supabase
        .from('users')
        .select('role, company_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Allow access if user has valid role and company_id
      setHasAccess(
        userData?.role === 'user' && 
        userData?.company_id !== null
      );
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default UserRouteGuard;
