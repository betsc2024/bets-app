import React, { useEffect, useState } from 'react';
import { supabase } from '@/supabase';
import { toast } from 'sonner';

import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";

export default function OverallStatus({ companyId, bankId, evaluationGroup }) {
  // States for dropdowns
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [evaluationGroups, setEvaluationGroups] = useState([]);
  const [selectedEvaluationGroup, setSelectedEvaluationGroup] = useState(null);

  // Add state for employee filter
  const [employeeFilter, setEmployeeFilter] = useState('all-employees');

  // If props are provided, use them and skip dropdowns
  useEffect(() => {
    if (companyId) {
      setSelectedCompany({ id: companyId });
    }
  }, [companyId]);
  useEffect(() => {
    if (bankId) {
      setSelectedBank({ id: bankId });
    }
  }, [bankId]);
  useEffect(() => {
    if (evaluationGroup) {
      setSelectedEvaluationGroup(evaluationGroup);
    }
  }, [evaluationGroup]);

  // Fetch companies on component mount (only if not provided)
  useEffect(() => {
    if (!companyId) fetchCompanies();
  }, []);

  // Fetch banks when company is selected (only if not provided)
  useEffect(() => {
    if (!companyId && selectedCompany) {
      fetchBanks();
      setSelectedBank(null);
      setSelectedEvaluationGroup(null);
    }
  }, [selectedCompany]);

  // Fetch evaluations when bank is selected (only if not provided)
  useEffect(() => {
    if (!bankId && selectedBank) {
      fetchEvaluations();
      setSelectedEvaluationGroup(null);
    }
  }, [selectedBank]);

  // Fetch evaluations if all props are provided
  useEffect(() => {
    if (companyId && bankId && !evaluationGroup) {
      fetchEvaluations();
    }
  }, [companyId, bankId]);

  // Fetch companies from Supabase
  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    }
  };

  // Fetch attribute banks from Supabase
  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('attribute_banks')
        .select('id, name')
        .eq('company_id', selectedCompany.id)
        .order('name');

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error('Failed to load banks');
    }
  };

  // Fetch evaluations for selected bank and group them
  const fetchEvaluations = async () => {
    try {
      const { data: assignments, error } = await supabase
        .from('evaluation_assignments')
        .select(`
          id,
          evaluation_name,
          created_at,
          user_to_evaluate:users!evaluation_assignments_user_to_evaluate_id_fkey (
            id,
            email,
            full_name
          ),
          evaluations:evaluations_evaluation_assignment_id_fkey (
            id,
            status,
            is_self_evaluator,
            relationship_type,
            evaluator:users!evaluations_evaluator_id_fkey (
              id,
              email,
              full_name
            )
          )
        `)
        .eq('company_id', selectedCompany.id)
        .eq('attribute_bank_id', selectedBank.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group assignments by evaluation name
      const groups = assignments.reduce((acc, curr) => {
        if (!acc[curr.evaluation_name]) {
          acc[curr.evaluation_name] = {
            name: curr.evaluation_name,
            assignments: []
          };
        }
        acc[curr.evaluation_name].assignments.push(curr);
        return acc;
      }, {});

      // Convert to array and sort by latest assignment
      const groupArray = Object.values(groups).sort((a, b) => {
        const aDate = new Date(a.assignments[0].created_at);
        const bDate = new Date(b.assignments[0].created_at);
        return bDate - aDate;
      });

      setEvaluationGroups(groupArray);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      toast.error('Failed to load evaluations');
    }
  };

  const renderEvaluationTable = () => {
    if (!selectedEvaluationGroup) return null;

    // Get all employees from assignments in selectedEvaluationGroup
    const employeeList = selectedEvaluationGroup && selectedEvaluationGroup.assignments
      ? selectedEvaluationGroup.assignments.map(a => a.user_to_evaluate)
      : [];

    // Remove duplicates by id and sort alphabetically by full_name
    const uniqueEmployees = employeeList
      .filter((emp, idx, arr) => emp && arr.findIndex(e => e.id === emp.id) === idx)
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    // Filter assignments for table rendering
    const filteredAssignments = employeeFilter === 'all-employees'
      ? (selectedEvaluationGroup?.assignments || [])
      : (selectedEvaluationGroup?.assignments || []).filter(a => a.user_to_evaluate?.id === employeeFilter);

    // Get all assignments for this evaluation group
    // const assignments = selectedEvaluationGroup.assignments;

    // Sort assignments by employee name
    // const sortedAssignments = [...assignments].sort((a, b) => {
    //   const nameA = a.user_to_evaluate?.full_name || '';
    //   const nameB = b.user_to_evaluate?.full_name || '';
    //   return nameA.localeCompare(nameB);
    // });

    return (
      <div className="mt-6">
        {/* Employee filter dropdown */}
        {uniqueEmployees.length > 0 && (
          <div className="mb-4">
            <Select
              value={employeeFilter}
              onValueChange={setEmployeeFilter}
              className="min-w-[220px]"
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Employee" />
              </SelectTrigger>
              <SelectContent>
                <ScrollArea className="h-[300px]">
                  <SelectGroup>
                    <SelectLabel>Employees</SelectLabel>
                    <SelectItem value="all-employees">All Employees</SelectItem>
                    {uniqueEmployees.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                    ))}
                  </SelectGroup>
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="border-r">Employee</TableHead>
                <TableHead className="border-r text-center">Self Evaluation</TableHead>
                <TableHead className="border-l">Evaluation Counts</TableHead>
                <TableHead className="border-l">Evaluators</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.map((assignment) => (
                <TableRow key={assignment.id} className="border-b">
                  {/* Employee Name */}
                  <TableCell className="border-r">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {assignment.user_to_evaluate?.full_name || 'Unknown'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {assignment.user_to_evaluate?.email || ''}
                      </span>
                    </div>
                  </TableCell>

                  {/* Self Evaluation Status */}
                  <TableCell className="border-r">
                    <div className="flex justify-center items-center">
                      {assignment.evaluations?.some(e => e.is_self_evaluator) ? (
                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md border">
                          <span className={getBadgeStyle(
                            assignment.evaluations.find(e => e.is_self_evaluator)?.status
                          )}>
                            ({getSelfEvalStatusBadge(
                              assignment.evaluations.find(e => e.is_self_evaluator)?.status
                            ).text})
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md border">
                          <span className="text-gray-500">(No)</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Evaluation Counts */}
                  <TableCell className="border-l">
                    {/* Mini-table for relationship type counts */}
                    <div className="flex flex-col gap-1">
                      {(() => {
                        // Group evaluations by relationship_type
                        const relMap = {};
                        assignment.evaluations?.forEach(e => {
                          if (e.is_self_evaluator) return;
                          const type = e.relationship_type || 'Peer';
                          if (!relMap[type]) relMap[type] = { pending: 0, completed: 0 };
                          if ((e.status || '').toLowerCase() === 'completed') relMap[type].completed += 1;
                          else relMap[type].pending += 1;
                        });
                        // Render mini-table
                        return Object.entries(relMap).map(([type, counts]) => (
                          <div key={type} className="flex flex-row gap-2 text-xs">
                            <span className="font-semibold">{type}:</span>
                            <span>Pending: {counts.pending}, Completed: {counts.completed}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </TableCell>

                  {/* Evaluators */}
                  <TableCell className="border-l">
                    <div className="flex flex-wrap gap-2">
                      {assignment.evaluations
                        ?.filter(e => !e.is_self_evaluator)
                        .map((evaluation, idx) => {
                          const status = getEvaluatorStatusBadge(evaluation.status);
                          return (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-2 py-1 rounded-md border"
                            >
                              <span className="max-w-[150px] truncate">
                                {evaluation.evaluator?.full_name || 'Unknown'}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={getRelationshipBadgeStyle(evaluation.relationship_type)}
                              >
                                {evaluation.relationship_type || 'peer'}
                              </Badge>
                              <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${getBadgeStyle(evaluation.status)}`}>
                                ({status.text})
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const getBadgeStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  };

  const getSelfEvalStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return {
          variant: 'success',
          text: 'Completed'
        };
      case 'in_progress':
        return {
          variant: 'warning',
          text: 'In Progress'
        };
      case 'pending':
        return {
          variant: 'secondary',
          text: 'Pending'
        };
      default:
        return {
          variant: 'outline',
          text: 'No'
        };
    }
  };

  const getEvaluatorStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return {
          variant: 'success',
          text: 'Completed'
        };
      case 'in_progress':
        return {
          variant: 'warning',
          text: 'In Progress'
        };
      case 'pending':
        return {
          variant: 'secondary',
          text: 'Pending'
        };
      default:
        return {
          variant: 'outline',
          text: 'Not Started'
        };
    }
  };

  const getRelationshipBadgeStyle = (type) => {
    const baseStyle = "text-xs";
    
    switch (type?.toLowerCase()) {
      case 'top_boss':
        return `${baseStyle} bg-blue-100 text-blue-800`;
      case 'hr':
        return `${baseStyle} bg-purple-100 text-purple-800`;
      case 'reporting_boss':
        return `${baseStyle} bg-green-100 text-green-800`;
      case 'peer':
        return `${baseStyle} bg-orange-100 text-orange-800`;
      case 'subordinate':
        return `${baseStyle} bg-pink-100 text-pink-800`;
      default:
        return `${baseStyle} bg-gray-100 text-gray-800`;
    }
  };

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-3xl font-bold text-primary mb-4">Overall Status</h1>
      
      {!(companyId && bankId && evaluationGroup) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full mb-6">
          {/* Company Selection */}
          <Select 
            value={selectedCompany?.id} 
            onValueChange={(value) => {
              const company = companies.find(c => c.id === value);
              setSelectedCompany(company);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Companies</SelectLabel>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Bank Selection */}
          <Select 
            value={selectedBank?.id} 
            onValueChange={(value) => {
              const bank = banks.find(b => b.id === value);
              setSelectedBank(bank);
            }}
            disabled={!selectedCompany}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Bank" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Banks</SelectLabel>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Evaluation Selection */}
          <Select 
            value={selectedEvaluationGroup?.name} 
            onValueChange={(value) => {
              const group = evaluationGroups.find(g => g.name === value);
              setSelectedEvaluationGroup(group);
            }}
            disabled={!selectedBank}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Evaluation" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Evaluations</SelectLabel>
                {evaluationGroups.map((group) => (
                  <SelectItem key={group.name} value={group.name}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Evaluation Table: Show if all selections are made (from props or state) */}
      {(companyId && bankId && evaluationGroup) || (selectedCompany && selectedBank && selectedEvaluationGroup) ? (
        <div>
          {renderEvaluationTable()}
        </div>
      ) : null}
    </div>
  );
}
