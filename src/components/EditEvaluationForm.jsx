import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { X, Users, UserPlus, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";

export function EditEvaluationForm({ evaluation, onSave, onCancel }) {
  const [evalName, setEvalName] = useState('');
  const [evaluators, setEvaluators] = useState([]);
  const [availableEvaluators, setAvailableEvaluators] = useState([]);
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState('');
  const [selectedRelationType, setSelectedRelationType] = useState('');
  const [loading, setLoading] = useState(true);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [currentEmployees, setCurrentEmployees] = useState([]);
  const scrollAreaRef = React.useRef(null);

  const relationshipTypes = [
    { value: 'top_boss', label: 'Top Boss' },
    { value: 'hr', label: 'HR' },
    { value: 'reporting_boss', label: 'Reporting Boss' },
    { value: 'peer', label: 'Peer' },
    { value: 'subordinate', label: 'Subordinate' }
  ];

  const getRelationshipBadgeStyle = (type) => {
    switch (type) {
      case 'top_boss':
        return 'bg-red-500 text-white';
      case 'hr':
        return 'bg-orange-500 text-white';
      case 'reporting_boss':
        return 'bg-yellow-500 text-black';
      case 'peer':
        return 'bg-green-500 text-white';
      case 'subordinate':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Fetch available users when evaluation changes
  useEffect(() => {
    const fetchUsers = async () => {
      if (evaluation) {
        console.log('EditEvaluationForm received evaluation:', evaluation);
        setLoading(true);
        try {
          // Get users from the same company as the evaluation
          const companyId = evaluation?.company_id || evaluation?.companies?.id;
          const { data: userData, error } = await supabase
            .from('users')
            .select('id, email, full_name')
            .eq('company_id', companyId)  // Filter users by company_id
            .order('full_name');

          if (error) throw error;

          console.log('Fetched users:', userData);

          // Get all current employees being evaluated
          const currentEvaluatees = evaluation.allAssignments?.map(a => a.user_to_evaluate_id) || [];
          setCurrentEmployees(currentEvaluatees);

          // Filter available employees (those not already being evaluated)
          const availableEmps = userData.filter(user => 
            !currentEvaluatees.includes(user.id)
          );
          setAvailableEmployees(availableEmps);

          // Filter available evaluators (excluding the person being evaluated)
          const currentEvaluatorIds = evaluation.evaluations
            ?.filter(e => !e.is_self_evaluator)
            .map(e => e.evaluator.id) || [];

          const available = userData.filter(user => 
            user.id !== evaluation.user_to_evaluate_id && 
            !currentEvaluatorIds.includes(user.id)
          );

          setAvailableEvaluators(available);
          setEvalName(evaluation.evaluation_name);
          setEvaluators(evaluation.evaluations?.filter(e => !e.is_self_evaluator) || []);
        } catch (err) {
          console.error('Error fetching users:', err);
          toast.error('Failed to load available users');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUsers();
  }, [evaluation]);

  const handleAddEmployee = () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee to add');
      return;
    }

    const newEmployee = availableEmployees.find(u => u.id === selectedEmployeeId);
    if (newEmployee) {
      setCurrentEmployees(prev => [...prev, newEmployee.id]);
      setAvailableEmployees(prev => prev.filter(u => u.id !== selectedEmployeeId));
      setSelectedEmployeeId('');
    }
  };

  const handleRemoveEmployee = (employeeId) => {
    const removedEmployee = availableEmployees.find(u => u.id === employeeId);
    if (removedEmployee) {
      setCurrentEmployees(prev => prev.filter(id => id !== employeeId));
      setAvailableEmployees(prev => [...prev, removedEmployee]);
    }
  };

  const handleAddEvaluator = async () => {
    if (!selectedEvaluatorId || !selectedRelationType) {
      toast.error('Please select both evaluator and relationship type');
      return;
    }

    const newEvaluator = availableEvaluators.find(u => u.id === selectedEvaluatorId);
    if (newEvaluator) {
      const newEvaluation = {
        evaluator: newEvaluator,
        relationship_type: selectedRelationType,
        status: 'pending',
        is_self_evaluator: false
      };

      setEvaluators([...evaluators, newEvaluation]);
      setAvailableEvaluators(prev => prev.filter(u => u.id !== selectedEvaluatorId));
      setSelectedEvaluatorId('');
      setSelectedRelationType('');
    }
  };

  const handleRemoveEvaluator = (evaluatorId) => {
    const removedEvaluator = evaluators.find(e => e.evaluator.id === evaluatorId);
    if (removedEvaluator) {
      setEvaluators(prev => prev.filter(e => e.evaluator.id !== evaluatorId));
      setAvailableEvaluators(prev => [...prev, removedEvaluator.evaluator]);
    }
  };

  const handleSave = async () => {
    if (!evalName.trim()) {
      toast.error('Evaluation name cannot be empty');
      return;
    }

    try {
      await onSave({
        ...evaluation,
        evaluation_name: evalName.trim(),
        evaluators,
        newEmployeeIds: currentEmployees
      });
      
      // Only refresh after successful save
      window.location.reload();
    } catch (error) {
      console.error('Error saving evaluation:', error);
      toast.error('Failed to save changes');
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="evaluation-name" className="text-right">Name</Label>
        <Input
          id="evaluation-name"
          value={evalName}
          onChange={(e) => setEvalName(e.target.value)}
          className="col-span-3"
        />
      </div>

      <Tabs defaultValue="evaluators" className="mt-6">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="evaluators">
            <Users className="h-4 w-4 mr-2" />
            Manage Evaluators
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evaluators">
          <div className="space-y-4">
            <div className="mb-4">
              <h5 className="text-sm text-gray-500 mb-2">Current Evaluators</h5>
              {evaluators.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
                  {evaluators.map((evaluator) => (
                    <div key={evaluator.evaluator.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div>
                        <span className="font-medium">{evaluator.evaluator.full_name}</span>
                        <Badge variant="outline" className={getRelationshipBadgeStyle(evaluator.relationship_type)}>
                          {evaluator.relationship_type ? relationshipTypes.find(t => t.value === evaluator.relationship_type)?.label || evaluator.relationship_type : 'Peer'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveEvaluator(evaluator.evaluator.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No evaluators assigned</p>
              )}
            </div>

            <div className="space-y-4">
              <h5 className="text-sm text-gray-500">Add New Evaluator</h5>
              <div className="flex gap-2">
                <Select value={selectedEvaluatorId} onValueChange={setSelectedEvaluatorId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select evaluator" />
                  </SelectTrigger>
                  <SelectContent className="w-[min(calc(100vw-2rem),400px)] p-0 relative">
                    <div className="absolute right-2 top-2 flex flex-col z-10">
                      <button 
                        type="button"
                        className="p-1 rounded-t bg-purple-100 hover:bg-purple-200 border border-purple-300"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (scrollAreaRef.current) {
                            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
                            if (viewport) viewport.scrollTop -= 100;
                          }
                        }}
                      >
                        <ChevronUp className="h-4 w-4 text-purple-600" />
                      </button>
                      <button 
                        type="button"
                        className="p-1 rounded-b bg-purple-100 hover:bg-purple-200 border border-purple-300 border-t-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (scrollAreaRef.current) {
                            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
                            if (viewport) viewport.scrollTop += 100;
                          }
                        }}
                      >
                        <ChevronDown className="h-4 w-4 text-purple-600" />
                      </button>
                    </div>
                    <ScrollArea ref={scrollAreaRef} className="h-[300px]">
                      <div className="p-1">
                        {availableEvaluators.map((user) => (
                          <SelectItem 
                            key={user.id} 
                            value={user.id} 
                            className="py-2 cursor-pointer hover:bg-purple-50"
                          >
                            <div>
                              <div className="font-medium">{user.full_name}</div>
                              {user.email && (
                                <div className="text-xs text-gray-500">{user.email}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                        {availableEvaluators.length === 0 && (
                          <div className="px-2 py-2 text-sm text-gray-500">
                            No more evaluators available
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </SelectContent>
                </Select>
                <Select value={selectedRelationType} onValueChange={setSelectedRelationType}>
                  <SelectTrigger className="w-[220px] border-purple-200 hover:border-purple-300 focus:ring-purple-200">
                    <SelectValue placeholder="Select Relationship Type" className="text-gray-600" />
                  </SelectTrigger>
                  <SelectContent className="w-[220px]">
                    {relationshipTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="py-3 hover:bg-purple-50 cursor-pointer">
                        <div className="font-medium">{type.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddEvaluator}>Add</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </div>
  );
}
