import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2 } from 'lucide-react';

const UserDashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    finished: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('company_id, role')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserData(data);
      await fetchUserStats(user.id, data.company_id);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserStats = async (userId, companyId) => {
    try {
      // Get evaluations where the user is either the evaluator or being evaluated
      const { data: evaluations, error } = await supabase
        .from('evaluations')
        .select(`
          id,
          status,
          evaluation_assignment_id,
          evaluation_assignments!inner (
            company_id
          )
        `)
        .eq('evaluation_assignments.company_id', companyId)
        .or(`evaluator_id.eq.${userId},user_to_evaluate_id.eq.${userId}`);

      if (error) throw error;

      const stats = evaluations.reduce((acc, curr) => {
        acc.total++;
        if (curr.status === 'completed') {
          acc.finished++;
        } else {
          acc.pending++;
        }
        return acc;
      }, { total: 0, pending: 0, finished: 0 });

      setStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.finished}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserDashboard;
