import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

const Status = ({ userId, companyId, bankId }) => {
  const [statusData, setStatusData] = useState([]);
  const tableRef = useRef(null);

  const fetchStatusData = async () => {
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          relationship_type,
          status,
          evaluation_assignments!inner(
            user_to_evaluate_id,
            company_id,
            attribute_bank_id
          )
        `)
        .eq('evaluation_assignments.user_to_evaluate_id', userId)
        .eq('evaluation_assignments.company_id', companyId)
        .eq('evaluation_assignments.attribute_bank_id', bankId)
        .not('relationship_type', 'is', null);

      if (error) throw error;

      // Group by relationship type and count status
      const statusByRelation = {};
      data.forEach(item => {
        if (!statusByRelation[item.relationship_type]) {
          statusByRelation[item.relationship_type] = {
            completed: 0,
            total: 0
          };
        }
        statusByRelation[item.relationship_type].total++;
        if (item.status === 'completed') {
          statusByRelation[item.relationship_type].completed++;
        }
      });

      // Convert to table format with proper formatting
      const tableData = Object.entries(statusByRelation).map(([type, counts], index) => ({
        srNo: index + 1,
        relationType: type
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        count: counts.total,
        status: `${counts.completed}/${counts.total}`,
        isComplete: counts.completed === counts.total
      }));

      setStatusData(tableData);
    } catch (error) {
      console.error('Error fetching status data:', error);
      toast.error('Failed to fetch status data');
    }
  };

  useEffect(() => {
    fetchStatusData();
  }, [userId, companyId, bankId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary">Evaluation Status</h2>
      </div>

      <div ref={tableRef} className="border rounded-lg p-4 bg-white">
        <Table className="border">
          <TableHeader>
            <TableRow className="border-b">
              <TableHead className="border-r w-16 font-semibold text-primary">Sr. No.</TableHead>
              <TableHead className="border-r font-semibold text-primary">Relation Type</TableHead>
              <TableHead className="border-r text-right font-semibold text-primary">Count</TableHead>
              <TableHead className="text-right font-semibold text-primary">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statusData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                  No evaluation data available
                </TableCell>
              </TableRow>
            ) : (
              statusData.map((row) => (
                <TableRow key={row.srNo} className="border-b">
                  <TableCell className="border-r">{row.srNo}</TableCell>
                  <TableCell className="border-r">{row.relationType}</TableCell>
                  <TableCell className="border-r text-right">{row.count}</TableCell>
                  <TableCell className={`text-right ${
                    row.isComplete ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {row.status}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Status;
