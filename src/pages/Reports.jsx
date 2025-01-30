import React, { useEffect, useState } from 'react';
import { supabase } from '@/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const Reports = () => {
  const [reports, setReports] = useState([]);
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
      await fetchUserReports(user.id, data.company_id);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserReports = async (userId, companyId) => {
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          id,
          status,
          is_self_evaluation,
          completed_at,
          evaluation_assignments!inner (
            id,
            evaluation_name,
            company_id
          )
        `)
        .eq('evaluation_assignments.company_id', companyId)
        .or(`evaluator_id.eq.${userId},user_to_evaluate_id.eq.${userId}`)
        .eq('status', 'completed');

      if (error) throw error;
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
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
    <Card>
      <CardHeader>
        <CardTitle>Evaluation Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{report.evaluation_assignments.evaluation_name}</TableCell>
                  <TableCell className="capitalize">
                    {report.is_self_evaluation ? 'Self Evaluation' : 'Peer Evaluation'}
                  </TableCell>
                  <TableCell className="capitalize">{report.status}</TableCell>
                  <TableCell>
                    {report.completed_at 
                      ? new Date(report.completed_at).toLocaleDateString()
                      : 'Not completed'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Reports;
