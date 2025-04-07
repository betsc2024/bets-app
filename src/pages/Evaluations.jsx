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
import { Search, Plus, X, Pencil, Trash2, Eye, User2, ArrowLeft } from 'lucide-react';
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
        .eq('company_id',company_id);
      
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
        toast.error("Failed to fetch evaluations: " + error.message);
        return;
      }

      if (!evaluations) {
        console.error('No evaluations data returned');
        toast.error("No evaluation data available");
        return;
      }

      console.log('Raw evaluations:', evaluations);
      setAssignments(evaluations);
    } catch (error) {
      console.error('Error in try-catch:', error);
      toast.error("An unexpected error occurred");
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
        .eq('company_id', companyId);

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      toast.error('Failed to fetch users');
      console.error('Error:', err);
    }
  };

  const fetchAssignments = async () => {
    try {
      console.log('Starting fetchAssignments...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      // console.log('Current user:', user?.id);
      
      // Get user data
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      // console.log('User data:', userData);

      // Get all assignments
      const { data: assignments, error } = await supabase
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
        `);

      if (error) {
        console.error('Error fetching assignments:', error);
        toast.error('Failed to fetch assignments');
        return;
      }

      // console.log('Raw assignments data:', assignments);

      // Group assignments by evaluation name
      const groupedAssignments = assignments.reduce((acc, assignment) => {
        const key = assignment.evaluation_name;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(assignment);
        return acc;
      }, {});

      // console.log('Final grouped assignments:', groupedAssignments);
      setAssignments(assignments);

    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while fetching assignments');
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

        // console.log('Creating assignment with data:', assignmentData);

        const { data: assignment, error: assignmentError } = await supabase
          .from('evaluation_assignments')
          .insert([assignmentData])
          .select()
          .single();

        if (assignmentError) {
          console.error('Assignment creation error:', assignmentError);
          throw assignmentError;
        }

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

        // Insert evaluations
        if (evaluationsData.length > 0) {
          const { error: evaluationsError } = await supabase
            .from('evaluations')
            .insert(evaluationsData);

          if (evaluationsError) {
            console.error('Evaluations creation error:', evaluationsError);
            throw evaluationsError;
          }
        }
      }

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

  const handleEditAssignment = async () => {
    try {
      if (!editingName.trim()) {
        toast.error('Evaluation name cannot be empty');
        return;
      }

      // Update evaluation assignment name
      const { error: assignmentError } = await supabase
        .from('evaluation_assignments')
        .update({ evaluation_name: editingName.trim() })
        .eq('id', editingAssignment.id);

      if (assignmentError) throw assignmentError;

      // First, get existing evaluations
      const { data: existingEvaluations, error: fetchError } = await supabase
        .from('evaluations')
        .select('*')
        .eq('evaluation_assignment_id', editingAssignment.id);

      if (fetchError) throw fetchError;

      // Create new evaluations for added users/evaluators
      const newEvaluations = [];
      editingUsers.forEach(userId => {
        editingEvaluators.forEach(evaluatorId => {
          const exists = existingEvaluations.some(
            ev => ev.user_to_evaluate_id === userId && ev.evaluator_id === evaluatorId
          );
          
          if (!exists) {
            newEvaluations.push({
              evaluation_assignment_id: editingAssignment.id,
              evaluator_id: evaluatorId,
              user_to_evaluate_id: userId,
              status: 'pending',
              started_at: null,
              completed_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        });
      });

      // Insert new evaluations if any
      if (newEvaluations.length > 0) {
        const { error: insertError } = await supabase
          .from('evaluations')
          .insert(newEvaluations);

        if (insertError) throw insertError;
      }

      // Delete removed evaluations
      const evaluationsToDelete = existingEvaluations.filter(ev => 
        !editingUsers.includes(ev.user_to_evaluate_id) || 
        !editingEvaluators.includes(ev.evaluator_id)
      );

      if (evaluationsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('evaluations')
          .delete()
          .in('id', evaluationsToDelete.map(e => e.id));

        if (deleteError) throw deleteError;
      }

      toast.success('Evaluation updated successfully');
      setEditingAssignment(null);
      fetchAssignments();
    } catch (err) {
      console.error('Error updating evaluation:', err);
      toast.error('Failed to update evaluation');
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

  const handleDeleteAssignment = async (evaluationName) => {
    try {
      // First get all assignments with this evaluation name
      const { data: assignmentsToDelete, error: fetchError } = await supabase
        .from('evaluation_assignments')
        .select('id')
        .eq('evaluation_name', evaluationName);

      if (fetchError) {
        console.error('Error fetching assignments:', fetchError);
        toast.error('Failed to delete evaluation');
        return;
      }

      // Get all assignment IDs
      const assignmentIds = assignmentsToDelete.map(a => a.id);

      // First delete all evaluations for these assignments
      const { error: evalError } = await supabase
        .from('evaluations')
        .delete()
        .in('evaluation_assignment_id', assignmentIds);

      if (evalError) {
        console.error('Error deleting evaluations:', evalError);
        toast.error('Failed to delete evaluation');
        return;
      }

      // Then delete all the evaluation assignments
      const { error: assignError } = await supabase
        .from('evaluation_assignments')
        .delete()
        .eq('evaluation_name', evaluationName);

      if (assignError) {
        console.error('Error deleting assignments:', assignError);
        toast.error('Failed to delete evaluation');
        return;
      }

      toast.success('Evaluation deleted successfully');
      fetchAssignments(); // Refresh the list
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while deleting');
    }
  };

  const handleEditEvaluation = async () => {
    try {
      const { error } = await supabase
        .from('evaluation_assignments')
        .update({
          evaluation_name: editingEvalName,
          status: editingEvalStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingEvaluation.id);

      if (error) throw error;

      toast.success('Evaluation updated successfully');
      setEditDialogOpen(false);
      fetchAssignments();
    } catch (err) {
      console.error('Error updating evaluation:', err);
      toast.error('Failed to update evaluation');
    }
  };

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

  // Only fetch users when bank changes
  // useEffect(() => {
  //   if (selectedBank) {
  //     console.log('Selected bank changed, fetching users...');
  //     fetchCompanyUsers(selectedBank.company_id);
  //   }
  // }, [selectedBank]);

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

  const renderEvaluationsTable = (evaluations) => {
    // If viewing details, use all assignments for this evaluation
    const assignmentsToShow = evaluations[0]?.allAssignments || evaluations;

    return (
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{assignmentsToShow[0]?.evaluation_name}</h3>
          <p className="text-sm text-gray-600">Bank: {assignmentsToShow[0]?.attribute_banks?.name}</p>
          <p className="text-sm text-gray-600">Company: {assignmentsToShow[0]?.companies?.name}</p>
        </div>
    


        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employees</TableHead>
                <TableHead>Self Evaluation</TableHead>
                <TableHead>Assigned to Evaluate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignmentsToShow.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {assignment.user_to_evaluate?.full_name || 'Unknown'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {assignment.user_to_evaluate?.email || ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {assignment.evaluations?.some(e => e.is_self_evaluator) ? "Yes" : "-"}
                  </TableCell>
                  <TableCell>
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
                    <Badge variant="outline" className="text-xs">
                      {assignment.evaluations?.[0]?.status || "Draft"}
                    </Badge>
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
    const groupedAssignments = assignments.reduce((acc, curr) => {
      if (!acc[curr.evaluation_name]) {
        acc[curr.evaluation_name] = {
          evaluation_name: curr.evaluation_name,
          bank: curr.attribute_banks,
          company: curr.companies,
          creator: curr.creator,
          assignments: []
        };
      }
      acc[curr.evaluation_name].assignments.push(curr);
      return acc;
    }, {});

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
                    {console.log(group)}
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div>
                          <span className="text-lg font-semibold">
                            {group.evaluation_name}
                          </span>
                          <div className="text-sm text-muted-foreground mt-1">
                            Company: {group.company?.name || 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Bank: {group.bank?.name || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-100"
                              onClick={() => {
                                setEditingEvaluation(group.assignments[0]);
                                setEditingEvalName(group.evaluation_name);
                                setEditingEvalStatus(group.assignments[0].status);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Evaluation</DialogTitle>
                              <DialogDescription>
                                Update the evaluation name and status
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="eval-name">Evaluation Name</Label>
                                <Input
                                  id="eval-name"
                                  value={editingEvalName}
                                  onChange={(e) => setEditingEvalName(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="eval-status">Status</Label>
                                <Select value={editingEvalStatus} onValueChange={setEditingEvalStatus}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleEditEvaluation}>
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
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
                                onClick={() => handleDeleteAssignment(group.evaluation_name)}
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
                    {/* <Button onClick={()=>{
                      toast.info("Sending Wait.... ");
                      group.assignments[0]?.evaluations.map((item)=>{
                        sendMail(item.evaluator.email,item.evaluator.full_name);
                      })
                    }} className="w-full" >
                      Send mail
                    </Button> */}
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
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
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

            <div>
              <Label>Select Company</Label>
              <Select value={selectedCompany?.id} onValueChange={(value) => {
                const company = companies.find(b => b.id === value);
                setSelectedCompany(company);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

{
  selectedCompany &&  <div className='row'>
              <div className='col'>
              <Label>Select Bank From : </Label>
              <input type = "radio"  className='mx-2' id="all" name="select_bank" defaultChecked onClick={()=>{
                setAllbanks(true);
              }} />
              <Label>All</Label>
              <input type = "radio" className='mx-2' id="specific" name="select_bank" onClick={()=>{
                setAllbanks(false);
              }}/>
              <Label>Industry Specific</Label>
              <Select value={selectedBank?.id} onValueChange={(value) => {
                const bank = banks.find(b => b.id === value);
                setSelectedBank(bank);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>}
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
                          <TableHead>Status</TableHead>
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
                                    onClick={() => {
                                      setCurrentUserId(user.id);
                                      setShowAssignDialog(true);
                                    }}
                                  >
                                    <Plus className="h-4 w-4" />
                                    Add
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Badge variant="outline" className="text-xs">
                                  Draft
                                </Badge>
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
                      <h2 className="text-2xl font-semibold">{selectedAssignmentForView.evaluation_name}</h2>
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
    </div>
  );
}
