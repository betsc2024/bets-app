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

const QuotientStatus = ({ userId, companyId, beforeBankId, afterBankId }) => {
  const [beforeBankStatus, setBeforeBankStatus] = useState([]);
  const [afterBankStatus, setAfterBankStatus] = useState([]);
  const [beforeBankName, setBeforeBankName] = useState('');
  const [afterBankName, setAfterBankName] = useState('');
  const tableRef = useRef(null);

  const fetchBankName = async (bankId) => {
    if (!bankId || bankId === 'none') return '';
    
    try {
      const { data, error } = await supabase
        .from('attribute_banks')
        .select('name')
        .eq('id', bankId)
        .single();
      
      if (error) throw error;
      return data?.name || '';
    } catch (error) {
      console.error('Error fetching bank name:', error);
      return '';
    }
  };

  const fetchStatusData = async (bankId) => {
    if (!bankId || bankId === 'none' || !userId || !companyId) return [];
    
    try {
      // Get all evaluations for this assignment
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('evaluations')
        .select(`
          relationship_type,
          status,
          evaluator_id,
          is_self_evaluator,
          evaluation_assignments!inner(
            user_to_evaluate_id,
            company_id,
            attribute_bank_id
          )
        `)
        .eq('evaluation_assignments.user_to_evaluate_id', userId)
        .eq('evaluation_assignments.company_id', companyId)
        .eq('evaluation_assignments.attribute_bank_id', bankId);

      if (evaluationsError) throw evaluationsError;

      // Process evaluations to get counts
      const evaluatorsByType = {};
      const completedByType = {};

      evaluationsData.forEach(evaluation => {
        const type = evaluation.is_self_evaluator ? 'self' : evaluation.relationship_type;
        
        // Initialize if not exists
        if (!evaluatorsByType[type]) {
          evaluatorsByType[type] = new Set();
          completedByType[type] = new Set();
        }
        
        // Add evaluator to total count
        evaluatorsByType[type].add(evaluation.evaluator_id);
        
        // If completed, add to completed count
        if (evaluation.status === 'completed') {
          completedByType[type].add(evaluation.evaluator_id);
        }
      });

      // Fixed relationship types in order (as specified by user)
      const relationOrder = ['Self', 'Top Boss', 'Peer', 'Hr', 'Subordinate', 'Reporting Boss'];
      const tableData = relationOrder.map((type, index) => {
        const relationKey = type.toLowerCase().replace(' ', '_');
        const totalCount = type === 'Self' ? 1 : (evaluatorsByType[relationKey]?.size || 0);
        const completed = type === 'Self' ? (completedByType[relationKey]?.size || 0) : (completedByType[relationKey]?.size || 0);
        
        return {
          srNo: index + 1,
          relationType: type,
          count: totalCount,
          completed: completed,
          status: `${completed}/${totalCount}`,
          completionPercentage: totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0,
          isComplete: completed === totalCount && totalCount > 0
        };
      }).filter(row => row.count > 0)
        .map((row, idx) => ({ ...row, srNo: idx + 1 }));

      return tableData;
    } catch (error) {
      console.error('Error fetching status data:', error);
      toast.error('Failed to fetch status data');
      return [];
    }
  };

  useEffect(() => {
    const loadData = async () => {
      // Fetch bank names
      if (beforeBankId) {
        const name = await fetchBankName(beforeBankId);
        setBeforeBankName(name);
      }
      
      if (afterBankId && afterBankId !== 'none') {
        const name = await fetchBankName(afterBankId);
        setAfterBankName(name);
      } else {
        setAfterBankName('');
      }
      
      // Fetch status data
      const beforeStatus = await fetchStatusData(beforeBankId);
      setBeforeBankStatus(beforeStatus);
      
      if (afterBankId && afterBankId !== 'none') {
        const afterStatus = await fetchStatusData(afterBankId);
        setAfterBankStatus(afterStatus);
      } else {
        setAfterBankStatus([]);
      }
    };
    
    loadData();
  }, [userId, companyId, beforeBankId, afterBankId]);

  const renderStatusTable = (statusData, bankName) => {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="text-lg font-semibold mb-2">{bankName}</h3>
        <Table className="border">
          <TableHeader>
            <TableRow className="border-b">
              <TableHead className="border-r w-16 font-semibold text-primary">Sr. No.</TableHead>
              <TableHead className="border-r font-semibold text-primary">Relation Type</TableHead>
              <TableHead className="border-r text-right font-semibold text-primary">Evaluators</TableHead>
              <TableHead className="text-right font-semibold text-primary">Completed</TableHead>
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
                  <TableCell className="text-right">
                    <span className={row.isComplete ? 'text-green-600' : ''}>
                      {row.status} ({row.completionPercentage}%)
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Only show After Bank status if afterBankId is set and not 'none'
  const showAfterBank = afterBankId && afterBankId !== 'none';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary">Evaluation Status</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before Bank Status */}
        <div ref={tableRef}>
          {renderStatusTable(beforeBankStatus, `Before Bank: ${beforeBankName}`)}
        </div>
        
        {/* After Bank Status (conditional) */}
        {showAfterBank && (
          <div>
            {renderStatusTable(afterBankStatus, `After Bank: ${afterBankName}`)}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuotientStatus;
