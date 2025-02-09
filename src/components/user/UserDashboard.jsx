import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const UserDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [evalCount,setEvalCount] = useState(null);
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

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      let temp_Data = {};
      console.log('Fetching evaluations for user:', user?.id);
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
  id,
    status,
    evaluator_id,
    is_self_evaluator,
    relationship_type,
    started_at,
    completed_at,
    evaluation_assignments (
      id,
      evaluation_name,
      users!evaluation_assignments_user_to_evaluate_id_fkey (
        id,
        full_name
      )
    )
  `)
  .eq('evaluator_id', user?.id)

      if (error) throw error;
      
      console.log('Fetched evaluations:', data);
      if(data){
        data.map((item)=>{
          if(!temp_Data[item.status]){
            temp_Data[item.status] = 1;
          }else{
            temp_Data[item.status]++;
          }
        })
        setEvalCount(temp_Data);
      }
    } catch (error) {
      console.error('Error fetching evaluations:', error);
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
   evalCount && 
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="text-2xl font-bold">
    { (evalCount['pending'] || evalCount['completed']) 
      ? (Number(evalCount['completed'] || 0) + Number(evalCount['pending'] || 0)) 
      : 0 }
  </div>      </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{evalCount['pending'] ? evalCount['pending'] : '0' }</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{evalCount['completed']  ? evalCount['completed'] : '0'}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserDashboard;
