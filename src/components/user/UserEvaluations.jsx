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
          started_at,
          completed_at,
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

      // Get existing responses
      const { data: existingResponses, error: responsesError } = await supabase
        .from('evaluation_responses')
        .select('statement_id, selected_option_id')
        .eq('evaluation_id', evaluationId);

      if (responsesError) throw responsesError;

      const responseMap = {};
      existingResponses.forEach(response => {
        responseMap[response.statement_id] = response.selected_option_id;
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

      // Validate all responses
      console.log(responses);

      // Prepare response data
      const responseData = statements.map(statement => ({
        evaluation_id: selectedEvaluation.id,
        statement_id: statement.id,
        selected_option_id: responses[statement.id],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      console.log(responseData);

      // Save responses
      const { error: responseError } = await supabase
        .from('evaluation_responses')
        .upsert(responseData);

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
      }
      return;
    }
    // No unsaved changes, close normally
    if (!open) setSelectedEvaluation(null);
  };

  const handleEvaluationClick = (evaluation) => {
    if (evaluation.status === 'completed') {
      toast.error('This evaluation has been completed and cannot be modified');
      return;
    }
    fetchEvaluationDetails(evaluation.id);
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
      <div className="text-center p-6 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, position: 'relative', maxWidth: 340 }}>
        <label htmlFor="bank-select" style={{ marginRight: 8, fontWeight: 500 }}>
          Select Bank:
        </label>
        <div style={{ position: 'relative', minHeight: 44 }}>
          <select
            id="bank-select"
            value={selectedBankId}
            onChange={e => setSelectedBankId(e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1.5px solid var(--primary, #a259e6)',
              minWidth: 180,
              maxWidth: '100%',
              width: '100%',
              fontSize: '1em',
              color: 'var(--primary-foreground, #4b2067)',
              background: 'var(--primary-bg, #f8f5fc)',
              fontWeight: 500,
              outline: 'none',
              boxShadow: '0 1px 4px 0 rgba(162,89,230,0.04)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              maxHeight: 200,
              overflowY: 'auto',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary, #7c3aed)')}
            onBlur={e => (e.target.style.borderColor = 'var(--primary, #a259e6)')}
          >
            <option value="">-- Choose a bank --</option>
            {assignedBanks.map(bank => (
              <option key={bank.id} value={bank.id}>{bank.name}</option>
            ))}
          </select>
          {/* Custom dropdown chevron icon */}
          <svg
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              width: 20,
              height: 20,
              fill: 'none',
              stroke: 'var(--primary, #a259e6)',
              strokeWidth: 2,
              zIndex: 2,
            }}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {/* Subtle evaluation count counter: Only show after a bank is selected */}
        {selectedBankId && (
          <div style={{ fontSize: '0.95em', color: '#888', marginTop: 4, marginLeft: 2 }}>
            Evaluations found: {
              evaluations.filter(ev => ev.evaluation_assignments?.attribute_banks?.id === selectedBankId).length
            }
          </div>
        )}
      </div>
      {selectedBankId ? (
        <div className="container mx-auto py-6">
          <h3 className="text-xl font-bold text-purple-800 mb-8">
            {userCompany !== "" ? user.user_metadata?.full_name + " - " + userCompany : ""}
          </h3>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {evaluations.filter(ev => ev.evaluation_assignments?.attribute_banks?.id === selectedBankId).map((evaluation) => (
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
                        evaluation.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {evaluation.status?.charAt(0).toUpperCase() + evaluation.status?.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {evaluations.filter(ev => ev.evaluation_assignments?.attribute_banks?.id === selectedBankId).length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-8">
                No pending evaluations found
              </div>
            )}
          </div>
            
          <Dialog 
            open={!!selectedEvaluation} 
            onOpenChange={handleDialogClose}
          >
            <DialogContent className="max-w-4xl h-auto max-h-[90vh] flex flex-col">
              <DialogHeader className="pb-6 border-b">
                <DialogTitle className="text-2xl font-semibold">
                  {selectedEvaluation?.is_self_evaluator 
                    ? 'Self Evaluation' 
                    : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-600">Evaluate:</span>
                        <span className="text-purple-800">{selectedEvaluation?.evaluation_assignments?.users?.full_name}</span>
                        <span className="text-gray-600">as</span>
                        <span className="text-purple-700">{selectedEvaluation?.relationship_type?.replace(/_/g, ' ') || 'Peer'}</span>
                        <span className="text-gray-600">by</span>
                        <span className="text-purple-800">{selectedEvaluation?.evaluator?.full_name || 'Unknown User'}</span>
                      </div>
                    )}
                </DialogTitle>
                <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-700 min-w-[120px]">Bank Name:</span>
                    <span className="text-gray-600">
                      {selectedEvaluation?.evaluation_assignments?.attribute_banks?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-700 min-w-[120px]">Evaluation Name:</span>
                    <span className="text-gray-600">
                      {selectedEvaluation?.evaluation_assignments?.evaluation_name || 'Unnamed Evaluation'}
                    </span>
                  </div>
                  {selectedEvaluation?.status === 'completed' && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-4 py-2.5 rounded-md border border-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        This evaluation is in read-only mode
                      </div>
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="flex-grow px-6 py-4 overflow-auto">
                {attributeGroups.length > 0 && flattenedStatements.length > 0 ? (
                  <div className="space-y-6">
                    {/* Progress indicator */}
                    <div className="bg-purple-50 rounded-lg p-4 mb-6 border-l-4 border-purple-600 sticky top-0 z-10">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold text-purple-800">
                            {flattenedStatements[currentStatementIndex]?.attributeName}
                          </h3>
                          <div className="text-xs text-gray-600 mt-1">
                            Attribute {currentAttributeIndex + 1} of {attributeGroups.length}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          Statement {flattenedStatements[currentStatementIndex]?.statementNumberInSection} of {attributeGroups[currentAttributeIndex]?.statements.length}
                        </div>
                      </div>
                      
                      {/* Attribute description if available */}
                      {flattenedStatements[currentStatementIndex]?.attributeDescription && (
                        <p className="text-gray-700 mt-2 text-sm">
                          {flattenedStatements[currentStatementIndex].attributeDescription}
                        </p>
                      )}
                    </div>

                    {/* Current statement with its options */}
                    {flattenedStatements[currentStatementIndex] && (
                      <div className="bg-gray-50 rounded-lg p-4 shadow-inner mb-4">
                        <div className="mb-3">
                          <h4 className="text-base font-semibold text-purple-800">
                            {flattenedStatements[currentStatementIndex].statementNumberInSection + ". " + flattenedStatements[currentStatementIndex].statement.statement}
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
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Loading statements...
                  </div>
                )}
              </div>

              <div className="border-t">
                {selectedEvaluation?.status !== 'completed' && (
                  <div className="p-4">
                    <EvaluationCheckpoint 
                      ref={evaluationCheckpointRef}
                      evaluationId={selectedEvaluation?.id}
                      responses={responses}
                      setResponses={setResponses}
                      isSubmitting={isSubmitting}
                      onCancel={() => handleDialogClose(false)}
                      onSubmit={handleSubmitEvaluation}
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