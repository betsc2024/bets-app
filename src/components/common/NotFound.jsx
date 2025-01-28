import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase';
import { useEffect, useState } from 'react';

export default function NotFound() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserRole(userData?.role);
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const handleBackToHome = () => {
    // Redirect based on user role
    if (userRole === 'admin' || userRole === 'super_admin') {
      navigate('/dashboard');
    } else {
      navigate('/user');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
        <p className="text-muted-foreground max-w-md">
          The page you're looking for doesn't exist or you don't have permission to access it.
        </p>
        <Button 
          onClick={handleBackToHome}
          className="mt-4"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}
