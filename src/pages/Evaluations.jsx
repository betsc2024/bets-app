import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { Search, Plus, X, Pencil, Trash2, Eye, User2, ArrowLeft, Check, Users } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '../components/ui/select';
import { MultiSelect } from '../components/ui/multi-select';
import { Label } from '../components/ui/label';
import * as Progress from "@radix-ui/react-progress";
import emailjs from '@emailjs/browser';
import { EditEvaluationForm } from '../components/EditEvaluationForm';
import { AddEmployeesForm } from '../components/AddEmployeesForm';

const StatusProgress = ({ currentStatus }) => {
  const statuses = ['draft', 'active'];
  const currentIndex = statuses.indexOf(currentStatus?.toLowerCase() || 'draft');
 


  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        {statuses.map((status, index) => (
          <div
            key={status}
            className={`flex flex-col items-center relative ${
              index <= currentIndex ? 'text-purple-600' : 'text-gray-400'
            }`}
          >
            {/* Connector Line */}
            {index < statuses.length - 1 && (
              <div
                className={`absolute w-full h-1 top-3 left-1/2 ${
                  index < currentIndex ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
            )}
            
            {/* Status Circle */}
            <div
              className={`w-6 h-6 rounded-full border-2 z-10 ${
                index === currentIndex
                  ? 'bg-white border-purple-600'
                  : index < currentIndex
                  ? 'bg-purple-600 border-purple-600'
                  : 'bg-white border-gray-300'
              }`}
            >
              {index <= currentIndex && (
                <div className="w-full h-full flex items-center justify-center">
                  {index === currentIndex ? (
                    <div className="w-2 h-2 rounded-full bg-purple-600" />
                  ) : (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              )}
            </div>
            
            {/* Status Label */}
            <span className="mt-2 text-sm capitalize">
              {status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Evaluations() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogSearchQuery, setDialogSearchQuery] = useState("");
  const [selectedUsersToEvaluate, setSelectedUsersToEvaluate] = useState([]);
  const [selectedEvaluators, setSelectedEvaluators] = useState(new Map());
  const [evaluatorRelationships, setEvaluatorRelationships] = useState(new Map());
  const [selfEvaluations, setSelfEvaluations] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [evaluationName, setEvaluationName] = useState('');
  const [selectedAssignmentForView, setSelectedAssignmentForView] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingEvaluators, setEditingEvaluators] = useState([]);
  const [editingUsers, setEditingUsers] = useState([]);
  const [showEvaluatorDialog, setShowEvaluatorDialog] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState(null);
  const [selectedUserToEvaluate, setSelectedUserToEvaluate] = useState(null);
  const [currentTab, setCurrentTab] = useState('create');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState(null);
  const [editingEvalName, setEditingEvalName] = useState('');
  const [editingEvalStatus, setEditingEvalStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const itemsPerPage = 8;
  const assignmentsPerPage = 10;
  const [companies, setCompanies] = useState([]);
  const  [selectedCompany ,setSelectedCompany] = useState(null);
  const  [allbanks, setAllbanks] = useState(true);

  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  const relationshipTypes = [
    { value: 'top_boss', label: 'Top Boss' },
    { value: 'hr', label: 'HR' },
    { value: 'reporting_boss', label: 'Reporting Boss' },
    { value: 'peer', label: 'Peer' },
    { value: 'subordinate', label: 'Subordinate' }
  ];

  const [selectedRelationType, setSelectedRelationType] = useState('peer');

  const [currentUserId, setCurrentUserId] = useState(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [tempSelfEvalChanges, setTempSelfEvalChanges] = useState(new Map());

  const [addEmployeesDialogOpen, setAddEmployeesDialogOpen] = useState(false);
  const [selectedEvaluationForEmployees, setSelectedEvaluationForEmployees] = useState(null);

  const startEditing = (assignment) => {
    setEditingRowId(assignment.id);
    // Initialize temp changes with current value
    setTempSelfEvalChanges(new Map([[
      assignment.id, 
      assignment.evaluations?.some(e => e.is_self_evaluator) || false
    ]]));
  };

  const cancelEditing = () => {
    setEditingRowId(null);
    setTempSelfEvalChanges(new Map());
  };

  const fetch_companies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select('*');
      if (data) {
        setCompanies(data);
      } else {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
      toast.error(error);
    }
  }

 useEffect(() => {
   fetch_companies();
 }, []);

//  const sendMail = (to_mail,to_name) => {
//   const service_Id = import.meta.env.VITE_EMAIL_SERVICE_ID;
//   const template_Id = import.meta.env.VITE_EMAIL_TEMPLATE_ID;
//   const public_Key = import.meta.env.VITE_EMAIL_PUBLIC_KEY;
//   const message = {
//     to_name : to_name,
//     to_email : to_mail,
//     from_name : "bets",
//     message : `
//      You have new Evalution please complete it.
//      Invite link : "http://localhost:5173/login"
//      UserName : ${to_mail}
//      Password : "123123"
//     `,
//   }

//   setShowProgress(true);
//   setProgress(0);
  
//   emailjs.send(service_Id,template_Id,message,public_Key).then(() => {
//     let value = 0;
//     const interval = setInterval(()=>{
//       value += 10;
//       setProgress(value);
//       if(value >=100){
//         clearInterval(interval);
//         setTimeout(() => setShowProgress(false), 500); // Hide after completion
//       }
//     },100)
//     console.log("Email sent successfully");
//     const date = new Date();
//     toast.message(`Email send successfully on ${date.toString()} ${to_mail}`);

//   },
//   (error)=>{
//     console.log(error);
//     toast.error(error);
//     setShowProgress(false);

//   }
//   );
//  };
 

  const fetchUsers = async (company_id) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('company_id',company_id)
        .order('full_name'); // Sort by full name A-Z

      if (error) throw error;
      // console.log(userData);
      setUsers(userData || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    }
  };

  useEffect(()=>{
    if(selectedCompany){
      // console.log(selectedCompany);
      fetchUsers(selectedCompany.id);
    }
  },[selectedCompany])

  const getStatusBadgeStyle = (status) => {
    const baseStyle = "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium";
  
    switch (status?.toLowerCase()) {
      case 'draft':
        return `${baseStyle} bg-gray-100 text-gray-800`;
      case 'active':
        return `${baseStyle} bg-green-100 text-green-800`;
      default:
        return `${baseStyle} bg-gray-100 text-gray-800`;
    }
  };

  const getRelationshipBadgeStyle = (type) => {
    const baseStyle = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
    switch (type) {
      case 'top_boss':
        return `${baseStyle} bg-purple-100 text-purple-800`;
      case 'hr':
        return `${baseStyle} bg-blue-100 text-blue-800`;
      case 'reporting_boss':
        return `${baseStyle} bg-indigo-100 text-indigo-800`;
      case 'peer':
        return `${baseStyle} bg-green-100 text-green-800`;
      case 'subordinate':
        return `${baseStyle} bg-orange-100 text-orange-800`;
      default:
        return `${baseStyle} bg-gray-100 text-gray-800`;
    }
  };

  const fetchEvaluations = async () => {
    try {
      console.log('Starting fetchEvaluations...');
      const { data: evaluations, error } = await supabase
        .from('evaluation_assignments')
        .select(`
          id,
          evaluation_name,
          user_to_evaluate:users!evaluation_assignments_user_to_evaluate_id_fkey (
            id,
            full_name,
            email
          ),
          evaluations (
            id,
            evaluator:users!evaluations_evaluator_id_fkey (
              id,
              full_name,
              email
            ),
            status,
            is_self_evaluator,
            relationship_type
          )
        `);

      if (error) {
        console.error('Error fetching evaluations:', error);
        throw error;
      }

      if (!evaluations) {
        console.error('No evaluations data returned');
        throw new Error('No evaluation data available');
      }

      console.log('Raw evaluations:', evaluations);
      setAssignments(evaluations);
    } catch (error) {
      console.error('Error in try-catch:', error);
      toast.error('Failed to fetch evaluations');
    }
  };

  const fetchBanks = async (type) => {
    try {
      const { data, error } = await supabase
        .from('attribute_banks')
        .select('id, name, description, company_id, created_by')
        .eq('status', 'active');

      if (error) throw error;

      if (data && data.length > 0) {
        const companyIds = [...new Set(data.map(bank => bank.company_id).filter(Boolean))];
        
        let companies = [];
        if (companyIds.length > 0) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('id, name')
            .in('id', companyIds);

          if (companyError) throw companyError;
          companies = companyData || [];
        }
        if(type  === false){
          // console.log(banks);
          
      
          const banksWithCompanies = data.filter((item)=>{
            return item.company_id === selectedCompany.id;
          });
  
          setBanks(banksWithCompanies);
        }else{
          setBanks(data);
        }
       
      } else {
        setBanks(data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyUsers = async (companyId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('company_id', companyId)
        .order('full_name'); // Sort by full name A-Z

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      toast.error('Failed to fetch users');
      console.error('Error:', err);
    }
  };

  const fetchAssignments = async () => {
    console.log('Starting fetchAssignments...');
    try {
      const { data: assignments, error } = await supabase
        .from('evaluation_assignments')
        .select(`
          *,
          companies!evaluation_assignments_company_id_fkey (
            id,
            name
          ),
          attribute_banks!evaluation_assignments_attribute_bank_id_fkey (
            id,
            name
          ),
          creator:users!evaluation_assignments_created_by_fkey (
            id,
            email,
            full_name
          ),
          user_to_evaluate:users!evaluation_assignments_user_to_evaluate_id_fkey (
            id,
            email,
            full_name
          ),
          evaluations!evaluations_evaluation_assignment_id_fkey (
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
        `);

      if (error) {
        console.error('Error fetching assignments:', error);
        throw error;
      }

      console.log('Fetched assignments:', assignments);
      setAssignments(assignments || []);
    } catch (error) {
      console.error('Error in fetchAssignments:', error);
      toast.error('Failed to fetch assignments');
    }
  };

  const handleUsersToEvaluateSelect = (selectedUsers) => {
    setSelectedUsersToEvaluate(selectedUsers);
    
    // Initialize self evaluations for new users
    const newSelfEvals = { ...selfEvaluations };
    selectedUsers.forEach(user => {
      if (!(user.id in newSelfEvals)) {
        newSelfEvals[user.id] = false;
      }
    });
    setSelfEvaluations(newSelfEvals);

    // Clean up removed users from evaluators map
    const currentUserIds = selectedUsers.map(u => u.id);
    setSelectedEvaluators(prev => {
      const newMap = new Map(prev);
      for (const userId of newMap.keys()) {
        if (!currentUserIds.includes(userId)) {
          newMap.delete(userId);
        }
      }
      return newMap;
    });
  };

  const addEvaluator = (userToEvaluateId, evaluatorId, relationshipType) => {
    setSelectedEvaluators(prev => {
      const newMap = new Map(prev);
      const currentEvaluators = newMap.get(userToEvaluateId) || [];
      if (!currentEvaluators.includes(evaluatorId)) {
        newMap.set(userToEvaluateId, [...currentEvaluators, evaluatorId]);
      }
      return newMap;
    });

    // Store the relationship type
    setEvaluatorRelationships(prev => {
      const newMap = new Map(prev);
      newMap.set(`${userToEvaluateId}-${evaluatorId}`, relationshipType);
      return newMap;
    });
  };

  const removeEvaluator = (userToEvaluateId, evaluatorId) => {
    setSelectedEvaluators(prev => {
      const newMap = new Map(prev);
      const currentEvaluators = newMap.get(userToEvaluateId) || [];
      newMap.set(userToEvaluateId, currentEvaluators.filter(id => id !== evaluatorId));
      return newMap;
    });

    // Remove the relationship type
    setEvaluatorRelationships(prev => {
      const newMap = new Map(prev);
      newMap.delete(`${userToEvaluateId}-${evaluatorId}`);
      return newMap;
    });
  };

  const handleSelfEvaluationChange = (userId) => {
    setSelfEvaluations(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const saveEvaluationAssignments = async () => {
    try {
      setIsSubmitting(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('No authenticated user found');
        return;
      }

      // Get selected bank's company_id since we know it's valid
      const { data: bankData, error: bankError } = await supabase
        .from('attribute_banks')
        .select('company_id')
        .eq('id', selectedBank.id)
        .single();

      if (bankError) {
        console.error('Error fetching bank data:', bankError);
        toast.error('Failed to fetch bank data');
        return;
      }

      const now = new Date().toISOString();

      // Create evaluation assignments for each user being evaluated
      for (const [userToEvaluateId, evaluators] of selectedEvaluators.entries()) {
        // Skip if no evaluators assigned
        if (!evaluators || evaluators.length === 0) continue;

        // Create assignment record using bank's company_id
        const assignmentData = {
          evaluation_name: evaluationName,
          attribute_bank_id: selectedBank.id,
          company_id: bankData.company_id, // Use bank's company_id
          user_to_evaluate_id: userToEvaluateId,
          created_by: user.id,
          created_at: now,
          updated_at: now,
          due_date: null
        };

        console.log('Creating assignment with data:', assignmentData);

        const { data: assignment, error: assignmentError } = await supabase
          .from('evaluation_assignments')
          .insert([assignmentData])
          .select()
          .single();

        if (assignmentError) throw assignmentError;

        console.log('Assignment created:', assignment);

        // Prepare evaluations data
        const evaluationsData = [];

        // Add self-evaluation if selected
        if (selfEvaluations[userToEvaluateId]) {
          evaluationsData.push({
            evaluation_assignment_id: assignment.id,
            evaluator_id: userToEvaluateId,
            status: 'pending',
            started_at: null,
            completed_at: null,
            created_at: now,
            updated_at: now,
            is_self_evaluator: true
          });
        }

        // Add peer evaluators
        evaluators.forEach(evaluatorId => {
          const relationshipType = evaluatorRelationships.get(`${userToEvaluateId}-${evaluatorId}`) || 'peer';
          evaluationsData.push({
            evaluation_assignment_id: assignment.id,
            evaluator_id: evaluatorId,
            status: 'pending',
            started_at: null,
            completed_at: null,
            created_at: now,
            updated_at: now,
            is_self_evaluator: false,
            relationship_type: relationshipType
          });
        });

        console.log('Evaluations data:', evaluationsData);

        // Insert evaluations
        if (evaluationsData.length > 0) {
          const { error: evaluationsError } = await supabase
            .from('evaluations')
            .insert(evaluationsData);

          if (evaluationsError) throw evaluationsError;
        }
      }

      console.log('All assignments created');

      toast.success('Evaluation created successfully');
      setEvaluationName('');
      setSelectedBank(null);
      setSelfEvaluations({});
      setSelectedEvaluators(new Map());
      setCurrentTab('manage');
      fetchAssignments();
    } catch (err) {
      console.error('Error creating evaluation:', err);
      toast.error('Failed to create evaluation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddEvaluator = async (userId) => {
    if (!editingEvaluators.includes(userId)) {
      setEditingEvaluators([...editingEvaluators, userId]);
    }
    setShowEvaluatorDialog(false);
  };

  const handleRemoveEvaluator = (evaluatorId) => {
    setEditingEvaluators(editingEvaluators.filter(id => id !== evaluatorId));
  };

  const handleAddUserToEvaluate = async (userId) => {
    if (!editingUsers.includes(userId)) {
      setEditingUsers([...editingUsers, userId]);
    }
    setShowEvaluatorDialog(false);
  };

  const handleRemoveUserToEvaluate = (userId) => {
    setEditingUsers(editingUsers.filter(id => id !== userId));
  };

  const handleDeleteEvaluation = async (assignment) => {
    try {
      // First delete all evaluations for this specific assignment
      const { error: evalError } = await supabase
        .from('evaluations')
        .delete()
        .eq('evaluation_assignment_id', assignment.id);

      if (evalError) throw evalError;

      // Then delete the specific assignment
      const { error: assignmentError } = await supabase
        .from('evaluation_assignments')
        .delete()
        .eq('id', assignment.id); // Only delete this specific assignment

      if (assignmentError) throw assignmentError;

      toast.success('Evaluation deleted successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while deleting');
    }
  };

  const handleSaveEvaluation = async (updatedEvaluation) => {
    try {
      console.log('Saving evaluation:', updatedEvaluation);

      // 1. Update evaluation assignment
      const { error: updateError } = await supabase
        .from('evaluation_assignments')
        .update({
          evaluation_name: updatedEvaluation.evaluation_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedEvaluation.id);

      if (updateError) throw updateError;

      // 2. Handle evaluators
      const currentEvaluatorIds = updatedEvaluation.evaluators.map(e => e.evaluator.id);

      // Remove evaluators that were deleted
      const evaluatorsToRemove = updatedEvaluation.evaluations
        ?.filter(e => !e.is_self_evaluator && !currentEvaluatorIds.includes(e.evaluator.id))
        .map(e => e.evaluator.id) || [];

      if (evaluatorsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('evaluations')
          .delete()
          .eq('evaluation_assignment_id', updatedEvaluation.id)
          .in('evaluator_id', evaluatorsToRemove);

        if (deleteError) throw deleteError;
      }

      // Add new evaluators
      const newEvaluators = updatedEvaluation.evaluators.filter(
        e => !updatedEvaluation.evaluations?.some(existing => existing.evaluator.id === e.evaluator.id)
      );

      for (const evaluator of newEvaluators) {
        const { error: insertError } = await supabase
          .from('evaluations')
          .insert({
            evaluation_assignment_id: updatedEvaluation.id,
            evaluator_id: evaluator.evaluator.id,
            relationship_type: evaluator.relationship_type,
            status: 'pending',
            is_self_evaluator: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
      }

      // 3. Handle new employees
      if (updatedEvaluation.newEmployeeIds?.length > 0) {
        for (const employeeId of updatedEvaluation.newEmployeeIds) {
          // Skip if already being evaluated
          if (updatedEvaluation.allAssignments.some(a => a.user_to_evaluate_id === employeeId)) {
            continue;
          }

          // First create evaluation_assignment
          const { data: newAssignment, error: assignmentError } = await supabase
            .from('evaluation_assignments')
            .insert({
              evaluation_name: updatedEvaluation.evaluation_name,
              company_id: updatedEvaluation.company_id,
              user_to_evaluate_id: employeeId,
              attribute_bank_id: updatedEvaluation.attribute_bank_id,
              created_by: updatedEvaluation.created_by,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (assignmentError) throw assignmentError;

          // Add self-evaluation
          const { error: selfEvalError } = await supabase
            .from('evaluations')
            .insert({
              evaluation_assignment_id: newAssignment.id,
              evaluator_id: employeeId,
              relationship_type: 'self',
              status: 'pending',
              is_self_evaluator: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (selfEvalError) throw selfEvalError;

          // Add evaluations for all current evaluators
          for (const evaluator of updatedEvaluation.evaluators) {
            const { error: evalError } = await supabase
              .from('evaluations')
              .insert({
                evaluation_assignment_id: newAssignment.id,
                evaluator_id: evaluator.evaluator.id,
                relationship_type: evaluator.relationship_type,
                status: 'pending',
                is_self_evaluator: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (evalError) throw evalError;
          }
        }
      }

      // 4. Refresh the data
      await fetchEvaluations();
      setEditDialogOpen(false);
      setAddEmployeesDialogOpen(false);
      toast.success('Evaluation updated successfully');
    } catch (error) {
      console.error('Error updating evaluation:', error);
      toast.error('Failed to update evaluation');
    }
  };

  const handleEditEvaluation = async () => {
    try {
      const { error } = await supabase
        .from('evaluation_assignments')
        .update({
          evaluation_name: editingEvalName,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingEvaluation.id);

      if (error) throw error;

      console.log('Evaluation updated');

      toast.success('Evaluation updated successfully');
      setEditDialogOpen(false);
      fetchAssignments();
    } catch (err) {
      console.error('Error updating evaluation:', err);
      toast.error('Failed to update evaluation');
    }
  };

  const handleSelfEvaluationUpdate = async (assignmentId) => {
    try {
      const checked = tempSelfEvalChanges.get(assignmentId);
      console.log('Starting update with:', { assignmentId, checked });
      
      // Get the evaluation ID for self-evaluation if it exists
      const assignment = assignments.find(a => a.id === assignmentId);
      const selfEvaluation = assignment?.evaluations?.find(e => e.is_self_evaluator);
      console.log('Current assignment:', assignment);
      console.log('Current self evaluation:', selfEvaluation);

      if (checked && !selfEvaluation) {
        console.log('Adding new self evaluation');
        // Add self-evaluation
        const { data: newEvaluation, error } = await supabase
          .from('evaluations')
          .insert({
            evaluation_assignment_id: assignmentId,
            evaluator_id: assignment.user_to_evaluate.id,
            status: 'pending',
            is_self_evaluator: true,
            relationship_type: 'self',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        console.log('New evaluation created:', newEvaluation);

        // Fetch the updated assignment with all relationships
        const { data: updatedAssignment, error: fetchError } = await supabase
          .from('evaluation_assignments')
          .select(`
            *,
            companies (
              id,
              name
            ),
            attribute_banks (
              id,
              name
            ),
            creator:users!evaluation_assignments_created_by_fkey (
              id,
              email,
              full_name
            ),
            user_to_evaluate:users!evaluation_assignments_user_to_evaluate_id_fkey (
              id,
              email,
              full_name
            ),
            evaluations (
              id,
              evaluator:users!evaluations_evaluator_id_fkey (
                id,
                email,
                full_name
              ),
              status,
              is_self_evaluator,
              relationship_type
            )
          `)
          .eq('id', assignmentId)
          .single();

        if (fetchError) throw fetchError;
        console.log('Fetched updated assignment:', updatedAssignment);

        // Update local state with full relationship data
        setAssignments(prev => {
          console.log('Previous assignments:', prev);
          const updated = prev.map(a => {
            if (a.id === assignmentId) {
              console.log('Updating assignment:', a.id);
              console.log('Updated assignment:', updatedAssignment);
              return updatedAssignment;
            }
            return a;
          });
          console.log('Updated assignments:', updated);
          return updated;
        });
      } else if (!checked && selfEvaluation) {
        console.log('Removing self evaluation:', selfEvaluation.id);
        // Remove self-evaluation
        const { error } = await supabase
          .from('evaluations')
          .delete()
          .eq('id', selfEvaluation.id);

        if (error) throw error;
        console.log('Self evaluation deleted successfully');

        // Fetch the updated assignment with all relationships
        const { data: updatedAssignment, error: fetchError } = await supabase
          .from('evaluation_assignments')
          .select(`
            *,
            companies (
              id,
              name
            ),
            attribute_banks (
              id,
              name
            ),
            creator:users!evaluation_assignments_created_by_fkey (
              id,
              email,
              full_name
            ),
            user_to_evaluate:users!evaluation_assignments_user_to_evaluate_id_fkey (
              id,
              email,
              full_name
            ),
            evaluations (
              id,
              evaluator:users!evaluations_evaluator_id_fkey (
                id,
                email,
                full_name
              ),
              status,
              is_self_evaluator,
              relationship_type
            )
          `)
          .eq('id', assignmentId)
          .single();

        if (fetchError) throw fetchError;
        console.log('Fetched updated assignment:', updatedAssignment);

        // Update local state with full relationship data
        setAssignments(prev => {
          console.log('Previous assignments:', prev);
          const updated = prev.map(a => {
            if (a.id === assignmentId) {
              console.log('Updating assignment:', a.id);
              console.log('Updated assignment:', updatedAssignment);
              return updatedAssignment;
            }
            return a;
          });
          console.log('Updated assignments:', updated);
          return updated;
        });
      }

      setEditingRowId(null);
      setTempSelfEvalChanges(new Map());
      toast.success('Self evaluation updated successfully');
    } catch (error) {
      console.error('Error updating self evaluation:', error);
      toast.error('Failed to update self evaluation');
    }
  };

  useEffect(() => {
    console.log('Assignments state changed:', assignments);
    assignments.forEach(assignment => {
      console.log('Assignment evaluations:', {
        id: assignment.id,
        evaluations: assignment.evaluations
      });
    });
  }, [assignments]);

  useEffect(() => {
    console.log('Temp self eval changes:', tempSelfEvalChanges);
  }, [tempSelfEvalChanges]);

  useEffect(() => {
    console.log('Self evaluations state changed:', selfEvaluations);
  }, [selfEvaluations]);

  useEffect(() => {
    console.log('Selected evaluators state changed:', selectedEvaluators);
  }, [selectedEvaluators]);

  useEffect(() => {
    console.log('Evaluator relationships state changed:', evaluatorRelationships);
  }, [evaluatorRelationships]);

  useEffect(() => {
    console.log('Editing row ID state changed:', editingRowId);
  }, [editingRowId]);

  // Consolidated useEffect for initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('Loading initial data...');
      await Promise.all([
        fetchAssignments(),
        fetchBanks(true)
      ]);
    };

    loadInitialData();
  }, []);

  useEffect(()=>{
    // console.log(allbanks);
    fetchBanks(allbanks);
  },[allbanks])

  useEffect(() => {
    if (selectedCompany) {
      setAllbanks(false);
      fetchBanks(false);
    } else {
      setAllbanks(true);
      fetchBanks(true);
    }
  }, [selectedCompany]);

  // Only fetch assignments when tab changes to manage
  useEffect(() => {
    if (currentTab === 'manage') {
      console.log('Tab changed to manage, fetching assignments...');
      fetchAssignments();
    }
  }, [currentTab]);

  const processEvaluations = (evaluations) => {
    if (!evaluations || evaluations.length === 0) return [];
    
    const evaluatorGroups = evaluations.map(evaluation => ({
      evaluator: evaluation.evaluator,
      is_self_evaluator: evaluation.is_self_evaluator,
      relationship_type: evaluation.relationship_type,
      status: evaluation.status
    }));

    return evaluatorGroups;
  };

  const handleAddNewEmployees = async (data) => {
    try {
      const now = new Date().toISOString();
      const { currentAssignment, newEmployeeIds } = data;

      // Create new evaluation assignments for each selected employee
      for (const employeeId of newEmployeeIds) {
        // Skip if already being evaluated
        if (currentAssignment.allAssignments?.some(a => a.user_to_evaluate_id === employeeId)) {
          continue;
        }

        // Create evaluation_assignment
        const { data: newAssignment, error: assignmentError } = await supabase
          .from('evaluation_assignments')
          .insert({
            evaluation_name: currentAssignment.evaluation_name,
            company_id: currentAssignment.company_id,
            user_to_evaluate_id: employeeId,
            attribute_bank_id: currentAssignment.attribute_bank_id,
            created_by: currentAssignment.created_by,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();

        if (assignmentError) throw assignmentError;

        // Add self-evaluation
        const { error: selfEvalError } = await supabase
          .from('evaluations')
          .insert({
            evaluation_assignment_id: newAssignment.id,
            evaluator_id: employeeId,
            relationship_type: 'self',
            status: 'pending',
            is_self_evaluator: true,
            created_at: now,
            updated_at: now
          });

        if (selfEvalError) throw selfEvalError;
      }

      toast.success('Employees added successfully');
      setAddEmployeesDialogOpen(false);
      fetchAssignments();
    } catch (error) {
      console.error('Error adding employees:', error);
      toast.error('Failed to add employees');
    }
  };

  const renderEvaluationsTable = (evaluations) => {
    // If viewing details, use all assignments for this evaluation
    const assignmentsToShow = evaluations[0]?.allAssignments || evaluations;
    const currentAssignment = assignmentsToShow[0];

    // Sort assignments by employee name
    const sortedAssignments = [...assignmentsToShow].sort((a, b) => {
      const nameA = a.user_to_evaluate?.full_name || '';
      const nameB = b.user_to_evaluate?.full_name || '';
      return nameA.localeCompare(nameB);
    });

    return (
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{currentAssignment?.evaluation_name}</h3>
          <p className="text-sm text-gray-600">Bank: {currentAssignment?.attribute_banks?.name}</p>
          <p className="text-sm text-gray-600">Company: {currentAssignment?.companies?.name || 'Not Assigned'}</p>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="border-r flex justify-between items-center p-4">
                  <span className="font-semibold text-sm">Employees</span>
                  <Dialog open={addEmployeesDialogOpen} onOpenChange={setAddEmployeesDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 hover:border-purple-300"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Employee
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Add Employee to Evaluation</DialogTitle>
                        <DialogDescription>
                          Add new employee to "{currentAssignment?.evaluation_name}"
                        </DialogDescription>
                      </DialogHeader>
                      <AddEmployeesForm
                        evaluation={{
                          ...currentAssignment,
                          allAssignments: assignmentsToShow,
                          evaluations: assignmentsToShow.flatMap(a => a.evaluations || [])
                        }}
                        onSave={handleAddNewEmployees}
                        onCancel={() => setAddEmployeesDialogOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </TableHead>
                <TableHead className="border-r">Self Evaluation</TableHead>
                <TableHead className="border-r">Assigned to Evaluate</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAssignments.map((assignment) => (
                <TableRow key={assignment.id} className="border-b">
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
                  <TableCell className="border-r">
                    <div className="flex justify-center items-center h-full">
                      <Checkbox
                        checked={editingRowId === assignment.id 
                          ? tempSelfEvalChanges.get(assignment.id)
                          : assignment.evaluations?.some(e => e.is_self_evaluator)}
                        disabled={editingRowId !== assignment.id}
                        onCheckedChange={(checked) => {
                          console.log('Checkbox changed:', { assignmentId: assignment.id, checked });
                          setTempSelfEvalChanges(prev => {
                            const newMap = new Map(prev).set(assignment.id, checked);
                            console.log('Updated temp changes:', Object.fromEntries(newMap));
                            return newMap;
                          });
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="border-r">
                    <div className="flex flex-wrap gap-2">
                      {assignment.evaluations
                        ?.filter(e => !e.is_self_evaluator)
                        .map((e, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="inline-flex items-center gap-2 bg-secondary/20 px-2 py-1 text-sm"
                          >
                            <span className="max-w-[150px] truncate">
                              {e.evaluator?.full_name || 'Unknown'}
                            </span>
                            <span className={getRelationshipBadgeStyle(e.relationship_type)}>
                              {e.relationship_type || 'peer'}
                            </span>
                          </Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {editingRowId === assignment.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-500 hover:text-green-700 hover:bg-green-100"
                            onClick={() => handleSelfEvaluationUpdate(assignment.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                            onClick={() => startEditing(assignment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
                            onClick={() => {
                              console.log('Opening edit dialog for evaluators:', assignment);
                              openEditDialog(assignment);
                            }}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                            onClick={() => {
                              console.log('Opening delete dialog for assignment:', assignment);
                              setAssignmentToDelete(assignment);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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

  const ManageEvaluations = () => {
    // Group assignments by evaluation name for card view
    const groupedAssignments = useMemo(() => {
      return assignments.reduce((acc, curr) => {
        const key = curr.evaluation_name;
        if (!acc[key]) {
          acc[key] = {
            evaluation_name: curr.evaluation_name,
            company: curr.companies,
            bank: curr.attribute_banks,
            assignments: []
          };
        }
        acc[key].assignments.push(curr);
        return acc;
      }, {});
    }, [assignments]);

    return (
      <div className="space-y-4">

        {selectedAssignmentForView ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAssignmentForView(null)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
            </div>
            {renderEvaluationsTable([selectedAssignmentForView])}
          </div>
        ) : (
          <>
            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.values(groupedAssignments).map((group) => (
                <Card key={group.evaluation_name} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div>
                          <span className="text-lg font-semibold">
                            {group.evaluation_name}
                          </span>
                          <div className="text-sm text-muted-foreground mt-1">
                            Company: {group.company?.name || 'Not Assigned'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Bank: {group.bank?.name || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Evaluation</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this evaluation and all its assignments? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteEvaluation(group.assignments[0])}
                                className="bg-red-500 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <CardDescription>
                      Created by: {group.creator?.full_name || 'Unknown'}
                      <br />
                      Evaluations: {group.assignments.length}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-2">
                      {group.assignments.slice(0, 2).map((assignment, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <User2 className="h-4 w-4 text-muted-foreground" />
                          <span>{assignment.user_to_evaluate?.full_name}</span>
                        </div>
                      ))}
                      {group.assignments.length > 2 && (
                        <div className="text-muted-foreground">
                          +{group.assignments.length - 2} more...
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col " >
                    <Button
                      variant="outline"
                      className="w-full mb-2 "
                      onClick={() => {
                        // Set all assignments for this evaluation name when viewing details
                        const allAssignmentsForEval = assignments.filter(
                          a => a.evaluation_name === group.evaluation_name
                        );
                        setSelectedAssignmentForView({
                          ...group.assignments[0],
                          allAssignments: allAssignmentsForEval
                        });
                      }}
                    >
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {assignments.length > 0 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setAssignmentPage(p => Math.max(1, p - 1))}
                      disabled={assignmentPage === 1}
                    />
                  </PaginationItem>
                  {[...Array(Math.ceil(assignments.length / assignmentsPerPage))].map((_, i) => (
                    <PaginationItem key={i + 1}>
                      <PaginationLink
                        onClick={() => setAssignmentPage(i + 1)}
                        isActive={assignmentPage === i + 1}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setAssignmentPage(p => Math.min(Math.ceil(assignments.length / assignmentsPerPage), p + 1))}
                      disabled={assignmentPage === Math.ceil(assignments.length / assignmentsPerPage)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    );
  };

  const EvaluatorDialog = () => {
    if (!showAssignDialog) return null;

    return (
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Add Evaluators</DialogTitle>
            <DialogDescription>
              Select evaluators and their relationship type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                placeholder="Search evaluators..."
                value={dialogSearchQuery}
                onChange={(e) => setDialogSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 p-2">
                {users
                  .filter(u => u.id !== currentUserId) // Filter out current user
                  .filter(u => {
                    // Get current evaluators for the user being evaluated
                    const currentEvaluators = selectedEvaluators.get(currentUserId) || [];
                    // Only show users who are not already evaluators
                    return !currentEvaluators.includes(u.id);
                  })
                  .filter(u => 
                    u.full_name.toLowerCase().includes(dialogSearchQuery.toLowerCase()) ||
                    u.email.toLowerCase().includes(dialogSearchQuery.toLowerCase())
                  )
                  .map((u) => (
                  <div key={u.id} className="flex items-center space-x-2 rounded-lg hover:bg-accent p-2">
                    <div className="flex-grow">
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-sm text-muted-foreground">{u.email}</div>
                    </div>
                    <Select
                      value={selectedRelationType}
                      onValueChange={setSelectedRelationType}
                    >
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue placeholder="Relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {relationshipTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        addEvaluator(currentUserId, u.id, selectedRelationType);
                        setDialogSearchQuery("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const openEditDialog = (evaluation) => {
    console.log('Opening edit dialog for evaluation:', evaluation);
    console.log('Evaluation details:', {
      id: evaluation.id,
      name: evaluation.evaluation_name,
      status: evaluation.status,
      evaluators: evaluation.evaluations?.filter(e => !e.is_self_evaluator) || []
    });
    setEditingEvaluation(evaluation);
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  // Filter users to exclude super admin
  const filteredUsers = users
    .filter(user => !user.email.includes('admin@bets.com'))
    .filter(user => 
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="p-6">
           { showProgress && (
        <div className="fixed bottom-4 right-4 w-[200px]">
          <Progress.Root
            className="relative h-[12px] w-full overflow-hidden rounded-full bg-gray-300 border"
            value={progress}
          >
            <Progress.Indicator
              className="h-full bg-green-500 transition-transform duration-300"
              style={{ transform: `translateX(-${100 - progress}%)` }}
            />
          </Progress.Root>
            <p>Email in Progress....</p>
        </div>
      )}
      <Tabs defaultValue={currentTab} onValueChange={setCurrentTab}>
        <TabsList>
          <TabsTrigger value="create">Create Evaluation</TabsTrigger>
          <TabsTrigger value="manage">Manage Evaluations</TabsTrigger>
        </TabsList>
        

        <TabsContent value="create" className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="evaluationName">Evaluation Name</Label>
              <Input
                id="evaluationName"
                value={evaluationName}
                onChange={(e) => setEvaluationName(e.target.value)}
                placeholder="Enter evaluation name"
              />
            </div>

            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={selectedCompany ? JSON.stringify(selectedCompany) : 'all'}
                onValueChange={(value) => {
                  const company = value === 'all' ? null : JSON.parse(value);
                  setSelectedCompany(company);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select Company" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto w-[min(calc(100vw-2rem),400px)]">
                  <div className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="all" className="py-2">
                      <div className="font-medium">All Companies</div>
                    </SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={JSON.stringify(company)} className="py-2">
                        <div className="font-medium">{company.name}</div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bank</Label>
              <Select
                value={selectedBank ? selectedBank.id.toString() : ''}
                onValueChange={(value) => {
                  const bank = banks.find(b => b.id.toString() === value);
                  setSelectedBank(bank || null);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select Bank" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto w-[min(calc(100vw-2rem),400px)]">
                  <div className="max-h-[300px] overflow-y-auto">
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id.toString()} className="py-2">
                        <div>
                          <div className="font-medium">{bank.name}</div>
                          {bank.description && (
                            <div className="text-xs text-gray-500">{bank.description}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {selectedBank && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Assign Evaluations</CardTitle>
                    <CardDescription>
                      Select users for self-evaluation and assign peer evaluators
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative w-full">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        placeholder="Search employees..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employees</TableHead>
                          <TableHead>Self Evaluation</TableHead>
                          <TableHead>Assigned to Evaluate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{user.full_name}</span>
                                <span className="text-sm text-muted-foreground">{user.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Checkbox
                                  checked={selfEvaluations[user.id] || false}
                                  onCheckedChange={(checked) => {
                                    setSelfEvaluations(prev => ({
                                      ...prev,
                                      [user.id]: checked
                                    }));
                                  }}
                                  disabled={selectedAssignmentForView !== null}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {(selectedEvaluators.get(user.id) || []).map((evaluatorId) => {
                                  const evaluator = users.find((u) => u.id === evaluatorId);
                                  const relationshipType = evaluatorRelationships.get(`${user.id}-${evaluatorId}`) || 'peer';
                                  return evaluator ? (
                                    <Badge
                                      key={evaluatorId}
                                      variant="outline"
                                      className="inline-flex items-center gap-2 bg-secondary/20 px-2 py-1 text-sm"
                                    >
                                      <span className="max-w-[150px] truncate">
                                        {evaluator.full_name}
                                      </span>
                                      <span className={getRelationshipBadgeStyle(relationshipType)}>
                                        {relationshipType}
                                      </span>
                                      <button
                                        onClick={() => removeEvaluator(user.id, evaluatorId)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  ) : null;
                                })}
                                {!selectedAssignmentForView && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 hover:border-purple-300"
                                    onClick={() => {
                                      setCurrentUserId(user.id);
                                      setShowAssignDialog(true);
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Button 
                  onClick={saveEvaluationAssignments}
                  disabled={!evaluationName || !selectedBank || 
                    (Object.values(selfEvaluations).every(v => !v) && 
                    Array.from(selectedEvaluators.values()).every(arr => arr.length === 0))}
                >
                  Create Evaluation
                </Button>
              </div>
            )}
          
          
          </div>

        </TabsContent>
          
        <TabsContent value="manage">
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-6">Evaluation Assignments</h1>
              
              {selectedAssignmentForView ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSelectedAssignmentForView(null);
                          setEditingAssignment(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Back
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    {renderEvaluationsTable([selectedAssignmentForView])}
                  </div>
                </div>
              ) : (
                <ManageEvaluations />
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <EvaluatorDialog />
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Evaluation</DialogTitle>
            <DialogDescription>
              Manage evaluators and update evaluation details.
            </DialogDescription>
          </DialogHeader>
          <EditEvaluationForm
            evaluation={editingEvaluation}
            onSave={handleSaveEvaluation}
            onCancel={() => setEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Assignment Confirmation Dialog */}
      <AlertDialog open={!!assignmentToDelete} onOpenChange={(open) => !open && setAssignmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evaluation Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this evaluation for {assignmentToDelete?.user_to_evaluate?.full_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAssignmentToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteEvaluation(assignmentToDelete);
                setAssignmentToDelete(null);
              }}
              className="bg-red-500 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
