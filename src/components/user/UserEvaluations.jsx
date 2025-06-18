import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import EvaluationCheckpoint from './EvaluationCheckpoint';

const UserEvaluations = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [statements, setStatements] = useState([]);
  const [responses, setResponses] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attributeGroups, setAttributeGroups] = useState([]);
  const { user } = useAuth();
  const [userCompany,setUserCompany] = useState("");
  const [c,setEvalCount] = useState(null);
  const [currentStatementIndex, setCurrentStatementIndex] = useState(0);
  const [flattenedStatements, setFlattenedStatements] = useState([]);
  const [currentAttributeIndex, setCurrentAttributeIndex] = useState(0);
  const evaluationCheckpointRef = useRef(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [assignedBanks, setAssignedBanks] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    if (user?.id) {
      fetchEvaluations();
      company();
    }
  }, [user]);

  const company = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", user.user_metadata?.company_id);
  
      if (data && data.length > 0) {
        console.log("Company Name:", data[0].name);
        setUserCompany(data[0].name);
      } else {
        console.log(error || "No company found");
      }
    } catch (e) {
      console.log("Error fetching company:", e);
    }
  };

  const getEvaluationStatus = (evaluation) => {
    if (evaluation.completed_at) {
      return "completed";
    }
    if (evaluation.draft_responses && evaluation.draft_responses.length > 0) {
      return "in_progress";
    }
    return "pending";
  };

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      setError(null);
      let temp_Data = {};
      console.log('Fetching evaluations for user:', user?.id);
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          id,
          status,
          evaluator:users!evaluations_evaluator_id_fkey (
            id,
            full_name
          ),
          is_self_evaluator,
          relationship_type,
          completed_at,
          draft_responses (
            id
          ),
          evaluation_assignments (
            id,
            evaluation_name,
            attribute_banks (
              id,
              name
            ),
            users!evaluation_assignments_user_to_evaluate_id_fkey (
              id,
              full_name
            )
          )
        `)
        .eq('evaluator_id', user?.id);

      if (error) throw error;
      console.log('Fetched evaluations:', data);
      if(data){
        data.map((item)=>{
          if(!temp_Data[item.status]){
            temp_Data[item.status] = 1;
          }
          temp_Data[item.status]++;
        })
        setEvalCount(temp_Data);
      }
      // Sort the data to show self evaluations first
      const sortedData = [...(data || [])].sort((a, b) => {
        if (a.is_self_evaluator && !b.is_self_evaluator) return -1;
        if (!a.is_self_evaluator && b.is_self_evaluator) return 1;
        return 0;
      });
      setEvaluations(sortedData);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      setError(error.message || 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (evaluations.length > 0) {
      const uniqueBanks = [];
      const seen = new Set();
      evaluations.forEach(ev => {
        const bank = ev.evaluation_assignments?.attribute_banks;
        if (bank && bank.id && !seen.has(bank.id)) {
          uniqueBanks.push({ id: bank.id, name: bank.name });
          seen.add(bank.id);
        }
      });
      setAssignedBanks(uniqueBanks);
    }
  }, [evaluations]);

  useEffect(() => {
    if (responses && Object.keys(responses).length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [responses]);

  const fetchEvaluationDetails = async (evaluationId) => {
    try {
      setLoading(true);
      console.log(evaluationId);
      // Get evaluation with assignment and bank details
      const { data: evaluationData, error: evaluationError } = await supabase
        .from('evaluations')
        .select(`
          id,
          status,
          relationship_type,
          is_self_evaluator,
          evaluator:users!evaluations_evaluator_id_fkey (
            id,
            full_name
          ),
          evaluation_assignments!inner(
            evaluation_name,
            attribute_banks!inner(
              id,
              name,
              description
            ),
            users!evaluation_assignments_user_to_evaluate_id_fkey (
             id,
             full_name
            )
          )
        `)
        .eq('id', evaluationId)
        .single();

      if (evaluationError) throw evaluationError;

      console.log(evaluationData);

      if (evaluationData.status === 'completed') {
        toast.error('This evaluation has been completed and cannot be modified');
        return;
      }

      // Get statements for the attribute bank with attribute information
      const { data: statementsData, error: statementsError } = await supabase
        .from('attribute_statements')
        .select(`
          id,
          statement,
          attribute_bank_id,
          attribute_id,
          attributes (
            id,
            name,
            description
          ),
          attribute_statement_options (
            id,
            option_text,
            weight
          )
        `)
        .eq('attribute_bank_id', evaluationData.evaluation_assignments.attribute_banks?.id)
        .order('created_at');

      if (statementsError) throw statementsError;

      // Fetch draft (in-progress) responses
      const { data: draftResponses, error: draftRespError } = await supabase
        .from('draft_responses')
        .select('statement_id, selected_option_id')
        .eq('evaluation_id', evaluationId);

      if (draftRespError) throw draftRespError;

      // Fetch final submitted responses (if any)
      const { data: finalResponses, error: finalRespError } = await supabase
        .from('evaluation_responses')
        .select('statement_id, selected_option_id')
        .eq('evaluation_id', evaluationId);

      if (finalRespError) throw finalRespError;

      // Merge: start with drafts, then let final responses overwrite if they exist
      const responseMap = {};
      (draftResponses || []).forEach(r => {
        responseMap[r.statement_id] = r.selected_option_id;
      });
      (finalResponses || []).forEach(r => {
        responseMap[r.statement_id] = r.selected_option_id;
      });

      // Group statements by attribute
      const groupedStatements = {};
      statementsData.forEach(statement => {
        const attributeId = statement.attribute_id;
        if (!groupedStatements[attributeId]) {
          groupedStatements[attributeId] = {
            attribute: statement.attributes,
            statements: []
          };
        }
        groupedStatements[attributeId].statements.push(statement);
      });

      // Convert to array for easier rendering
      const attributeGroupsArray = Object.values(groupedStatements);

      console.log(responseMap);

      setSelectedEvaluation({
        ...evaluationData,
        isReadOnly: evaluationData.status === 'completed'
      });
      setStatements(statementsData || []);
      setResponses(responseMap);
      setAttributeGroups(attributeGroupsArray);
    } catch (error) {
      console.error('Error loading evaluation details:', error);
      toast.error(error.message || 'Failed to load evaluation details');
      setSelectedEvaluation(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (attributeGroups.length > 0) {
      // Flatten all statements from all attribute groups for easy navigation
      const flattened = [];
      attributeGroups.forEach((group, groupIndex) => {
        let statementNumberInSection = 1; // Reset counter for each section
        group.statements.forEach(statement => {
          flattened.push({
            statement,
            attributeIndex: groupIndex,
            attributeName: group.attribute?.name || `Section ${groupIndex + 1}`,
            attributeDescription: group.attribute?.description || '',
            statementNumberInSection: statementNumberInSection++ // Track statement number within section
          });
        });
      });
      setFlattenedStatements(flattened);
      setCurrentStatementIndex(0);
      setCurrentAttributeIndex(0);
    }
  }, [attributeGroups]);

  const handleOptionSelect = (statementId, optionId) => {
    console.log('Selected option:', { statementId, optionId });
    setResponses(prev => ({
      ...prev,
      [statementId]: optionId  // Don't parse as integer, keep as string for UUID
    }));
  };

  const handleNextStatement = () => {
    if (currentStatementIndex < flattenedStatements.length - 1) {
      setCurrentStatementIndex(prevIndex => {
        const newIndex = prevIndex + 1;
        setCurrentAttributeIndex(flattenedStatements[newIndex].attributeIndex);
        return newIndex;
      });
    }
  };

  const handlePreviousStatement = () => {
    if (currentStatementIndex > 0) {
      setCurrentStatementIndex(prevIndex => {
        const newIndex = prevIndex - 1;
        setCurrentAttributeIndex(flattenedStatements[newIndex].attributeIndex);
        return newIndex;
      });
    }
  };

  const goToStatement = (index) => {
    if (index >= 0 && index < flattenedStatements.length) {
      setCurrentStatementIndex(index);
      setCurrentAttributeIndex(flattenedStatements[index].attributeIndex);
    }
  };

  const handleSubmitEvaluation = async () => {
    try {
      if (selectedEvaluation?.status === 'completed') {
        toast.error('This evaluation has been completed and cannot be submitted again');
        return;
      }

      const unanswered = flattenedStatements.filter(stmt => !responses[stmt.statement.id]);
      if (unanswered.length > 0) {
        toast.error('Please complete all questions before submitting');
        return;
      }

      setIsSubmitting(true);

      // First, check if there are any existing responses
      const { data: existingResponses, error: fetchError } = await supabase
        .from('evaluation_responses')
        .select('id, statement_id')
        .eq('evaluation_id', selectedEvaluation.id);

      if (fetchError) throw fetchError;

      // Prepare response data
      const responseData = statements.map(statement => {
        const existingResponse = existingResponses?.find(r => r.statement_id === statement.id);
        return {
          ...(existingResponse?.id ? { id: existingResponse.id } : {}), // Include id if it exists
          evaluation_id: selectedEvaluation.id,
          statement_id: statement.id,
          selected_option_id: responses[statement.id],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      // Save responses using upsert
      const { error: responseError } = await supabase
        .from('evaluation_responses')
        .upsert(responseData, {
          onConflict: 'evaluation_id,statement_id',
          ignoreDuplicates: false
        });

      if (responseError) throw responseError;

      // Update evaluation status
      const { error: statusError } = await supabase
        .from('evaluations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedEvaluation.id);

      if (statusError) throw statusError;

      toast.success('Evaluation submitted successfully');
      setSelectedEvaluation(null);
      fetchEvaluations();
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(error.message || 'Failed to submit evaluation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    const unanswered = flattenedStatements.filter(stmt => !responses[stmt.statement.id]);
    if (unanswered.length > 0) {
      toast.error('Please complete all questions before submitting');
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async (confirmed) => {
    setShowConfirmDialog(false);
    if (confirmed) {
      handleSubmitEvaluation();
    }
  };

  const handleDialogClose = (open) => {
    // If dialog is being closed and there are unsaved changes
    if (!open && evaluationCheckpointRef.current?.hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        setSelectedEvaluation(null);
        setHasUnsavedChanges(false);
        setResponses({});
      }
      return;
    }
    // No unsaved changes, close normally
    if (!open) {
      setSelectedEvaluation(null);
      setHasUnsavedChanges(false);
      setResponses({});
    }
  };

  const handleEvaluationClick = (evaluation) => {
    if (evaluation.status === 'completed') {
      toast.error('This evaluation has been completed and cannot be modified');
      return;
    }
    fetchEvaluationDetails(evaluation.id);
  };

  // Calculate overall progress based on answered statements
  const calculateProgress = () => {
    if (!flattenedStatements.length) return 0;
    const answeredStatements = Object.keys(responses).length;
    return (answeredStatements / flattenedStatements.length) * 100;
  };

  const handleExit = async (action) => {
    switch (action) {
      case 'save':
        // Check if there are any existing responses
        if (evaluationCheckpointRef.current?.hasUnsavedChanges) {
          // Wait for auto-save to complete (2 seconds)
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
        setShowExitDialog(false);
        handleDialogClose(false);
        // Refresh list so this evaluation moves from pending to in_progress
        await fetchEvaluations();
        break;
      case 'continue':
        setShowExitDialog(false);
        break;
      case 'exit':
        setShowExitDialog(false);
        handleDialogClose(false);
        // Refresh evaluations list
        await fetchEvaluations();
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center   -6 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1" style={{ maxWidth: 340 }}>
          <label htmlFor="bank-select" className="text-sm font-medium mb-2 block text-foreground">
            Select Bank:
          </label>
          <select
            id="bank-select"
            value={selectedBankId}
            onChange={e => setSelectedBankId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm
              focus:border-primary hover:border-primary
              file:border-0 file:bg-transparent file:text-sm file:font-medium 
              placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1
              focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50
              max-h-[200px] overflow-y-auto
              scrollbar-thin scrollbar-thumb-primary scrollbar-track-primary/10"
          >
            <option value="">-- Choose a bank --</option>
            {assignedBanks.map(bank => (
              <option key={bank.id} value={bank.id} className="py-1">{bank.name}</option>
            ))}
          </select>
          {selectedBankId && (
            <div className="text-sm text-muted-foreground mt-2 ml-1">
              Evaluations found: {
                evaluations
                  .filter(ev => ev.evaluation_assignments?.attribute_banks?.id === selectedBankId)
                  .filter(ev => selectedStatus === 'all' || getEvaluationStatus(ev) === selectedStatus)
                  .length
              }
            </div>
          )}
        </div>

        <div className="relative" style={{ width: 200 }}>
          <label htmlFor="status-select" className="text-sm font-medium mb-2 block text-foreground">
            Status:
          </label>
          <select
            id="status-select"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm
              focus:border-primary hover:border-primary
              file:border-0 file:bg-transparent file:text-sm file:font-medium 
              placeholder:text-muted-foreground focus-visible:outline-none focus:ring-1
              focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50
              max-h-[200px] overflow-y-auto
              scrollbar-thin scrollbar-thumb-primary scrollbar-track-primary/10"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      {selectedBankId ? (
        <div className="container mx-auto py-6">
          <h3 className="text-xl font-bold text-purple-800 mb-8">
            {userCompany !== "" ? user.user_metadata?.full_name + " - " + userCompany : ""}
          </h3>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {evaluations
              .filter(ev => ev.evaluation_assignments?.attribute_banks?.id === selectedBankId)
              .filter(ev => selectedStatus === 'all' || getEvaluationStatus(ev) === selectedStatus)
              .map((evaluation) => (
              <div
                key={evaluation.id}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => handleEvaluationClick(evaluation)}
              >
                <div className="flex flex-col gap-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    {evaluation.is_self_evaluator ? (
                      'Self Evaluation : '+ user.user_metadata?.full_name
                    ) : (
                      <>
                        Evaluate: {evaluation.evaluation_assignments?.users?.full_name} as 
                        <span className="text-purple-600 ml-2">
                          ({evaluation.relationship_type?.replace(/_/g, ' ') || 'Peer'})
                        </span>
                        {user.user_metadata?.full_name}
                      </>
                    )}
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Evaluation:</span>
                      <span className="text-gray-600">
                        {evaluation.evaluation_assignments?.evaluation_name || 'Unnamed Evaluation'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-medium">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        getEvaluationStatus(evaluation) === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : getEvaluationStatus(evaluation) === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {getEvaluationStatus(evaluation)?.charAt(0).toUpperCase() + getEvaluationStatus(evaluation)?.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {evaluations
              .filter(ev => ev.evaluation_assignments?.attribute_banks?.id === selectedBankId)
              .filter(ev => selectedStatus === 'all' || getEvaluationStatus(ev) === selectedStatus)
              .length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                No pending evaluations found
              </div>
            )}
          </div>
            
          <Dialog 
            open={!!selectedEvaluation} 
            onOpenChange={handleDialogClose}
          >
            <DialogContent className="w-full max-w-full h-full p-2 sm:p-4 md:p-6 md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[95vh] overflow-y-auto flex flex-col justify-between">
              <DialogHeader className="pb-0 mb-0">
                <div className="flex flex-col gap-1">
                  <DialogTitle className="text-2xl font-semibold mb-0">
                    {selectedEvaluation?.is_self_evaluator 
                      ? 'Self Evaluation' 
                      : (
                        <div className="flex items-baseline gap-2">
                          <span className="text-gray-600">Evaluate:</span>
                          <span className="text-purple-800">{selectedEvaluation?.evaluation_assignments?.users?.full_name}</span>
                          <span className="text-gray-600">as</span>
                          <span className="text-purple-700">{selectedEvaluation?.relationship_type?.replace(/_/g, ' ') || 'Peer'}</span>
                          <span className="text-gray-600">by</span>
                          <span className="text-purple-800">{selectedEvaluation?.evaluator?.full_name}</span>
                        </div>
                      )}
                  </DialogTitle>
                  <div className="flex items-center gap-2 text-sm mb-4">
                    <span className="font-medium text-gray-700">Bank:</span>
                    <span className="text-gray-600">
                      {selectedEvaluation?.evaluation_assignments?.attribute_banks?.name || 'N/A'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="text-sm mb-1">
                      <span className="text-gray-600">Evaluation Progress</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-purple-600 h-full transition-all duration-300 ease-out"
                        style={{ width: `${calculateProgress()}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Attribute section */}
                <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                        {flattenedStatements[currentStatementIndex]?.attributeName} 
                        <span className="text-gray-600 font-normal text-base">
                          ({currentAttributeIndex + 1} / {attributeGroups.length})
                        </span>
                      </h3>
                    </div>
                  </div>
                  {flattenedStatements[currentStatementIndex]?.attributeDescription && (
                    <p className="text-gray-700 mt-3 text-sm">
                      {flattenedStatements[currentStatementIndex].attributeDescription}
                    </p>
                  )}
                </div>
                {flattenedStatements[currentStatementIndex] ? (
                  <div className="bg-gray-50 rounded-lg p-4 shadow-inner">
                    <div>
                      <h4 className="text-base font-semibold text-purple-800 flex items-baseline gap-2">
                        <span>
                          {flattenedStatements[currentStatementIndex].statementNumberInSection + ". " + flattenedStatements[currentStatementIndex].statement.statement}
                        </span>
                        <span className="text-sm text-gray-600 font-normal">
                          ({flattenedStatements[currentStatementIndex]?.statementNumberInSection} / {attributeGroups[currentAttributeIndex]?.statements.length})
                        </span>
                      </h4>
                    </div>
                    <RadioGroup
                      value={responses[flattenedStatements[currentStatementIndex].statement.id]}
                      onValueChange={(value) => {
                        if (selectedEvaluation?.status === 'completed') {
                          toast.error('This evaluation has been completed and cannot be edited');
                          return;
                        }
                        handleOptionSelect(flattenedStatements[currentStatementIndex].statement.id, value);
                      }}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                    >
                      {flattenedStatements[currentStatementIndex].statement.attribute_statement_options
                        ?.sort((a, b) => b.weight - a.weight)
                        .map((option) => (
                          <div 
                            key={option.id}
                            className="flex items-center space-x-2 bg-white p-3 rounded-md shadow-sm hover:bg-gray-50 h-full"
                          >
                            <RadioGroupItem 
                              value={option.id} 
                              id={`option-${flattenedStatements[currentStatementIndex].statement.id}-${option.id}`}
                              className="h-4 w-4"
                            />
                            <Label 
                              htmlFor={`option-${flattenedStatements[currentStatementIndex].statement.id}-${option.id}`}
                              className="flex-1 text-gray-700 cursor-pointer text-sm"
                            >
                              {option.option_text}
                            </Label>
                          </div>
                        ))}
                    </RadioGroup>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">No statement found.</div>
                )}
              </DialogHeader>

              <div className="flex-grow px-6 -mt-4 mb-0">
                {attributeGroups.length > 0 && flattenedStatements.length > 0 ? (
                  <div>
                    {/* Current statement with its options */}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    Loading statements...
                  </div>
                )}
              </div>

              <div className="border-t mt-0">
                {selectedEvaluation?.status !== 'completed' && (
                  <div className="px-4 py-2">
                    <EvaluationCheckpoint 
                      ref={evaluationCheckpointRef}
                      evaluationId={selectedEvaluation?.id}
                      responses={responses}
                      setResponses={setResponses}
                      isSubmitting={isSubmitting}
                      onCancel={() => setShowExitDialog(true)}
                      onSubmit={handleSubmitEvaluation}
                      buttonText={{
                        cancel: 'Exit',
                        submit: 'Submit'
                      }}
                      rightContent={
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={handlePreviousStatement}
                            disabled={currentStatementIndex === 0}
                            variant="outline"
                            className="flex items-center text-xs px-3 py-1 h-8"
                            size="sm"
                          >
                            <ChevronLeft className="mr-1 h-3 w-3" />
                            Prev
                          </Button>

                          {currentStatementIndex !== flattenedStatements.length - 1 ? (
                            <Button
                              onClick={handleNextStatement}
                              disabled={currentStatementIndex === flattenedStatements.length - 1}
                              variant="outline"
                              className="flex items-center text-xs px-3 py-1 h-8"
                              size="sm"
                            >
                              Next
                              <ChevronRight className="ml-1 h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              onClick={handleSubmitClick}
                              disabled={isSubmitting}
                              className="flex items-center text-xs px-3 py-1 h-8"
                              size="sm"
                            >
                              Submit Evaluation
                            </Button>
                          )}
                        </div>
                      }
                    />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Exit confirmation dialog */}
          <Dialog 
            open={showExitDialog} 
            onOpenChange={(open) => {
              setShowExitDialog(open);
              if (!open) {
                // If dialog is being closed by clicking outside
                setShowExitDialog(false);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Exit Evaluation?</DialogTitle>
                <DialogDescription>
                  Choose how you would like to proceed:
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 mt-4">
                <Button 
                  variant="default" 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => handleExit('save')}
                >
                  Save and Exit
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleExit('continue')}
                >
                  Continue Evaluating
                </Button>
                <Button 
                  variant="ghost" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleExit('exit')}
                >
                  Exit Without Saving
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Confirmation Dialog */}
          <Dialog open={showConfirmDialog} onOpenChange={() => setShowConfirmDialog(false)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Submit Evaluation</DialogTitle>
                <DialogDescription>
                  Are you sure you want to submit this evaluation? Once submitted, it cannot be edited.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-between sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleConfirmSubmit(false)}
                >
                  Continue Editing
                </Button>
                <Button
                  type="button"
                  onClick={() => handleConfirmSubmit(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Evaluation'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </div>
  );
};

export default UserEvaluations;