import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { ScrollArea } from "../../components/ui/scroll-area";
import { toast } from 'sonner';

const UserEvaluations = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [statements, setStatements] = useState([]);
  const [responses, setResponses] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const [userCompany,setUserCompany] = useState("");
  const [c,setEvalCount] = useState(null);
  // console.log(user.user_metadata?.full_name); Debugging

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
          }
          temp_Data[item.status]++;
        })
        setEvalCount(temp_Data);
      }
      setEvaluations(data || []);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      setError(error.message || 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

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
      // attributes!inner(
      //   id,
      //   name,
      //   description
      // ),

      // Get statements for the attribute bank >>>Prev
      const { data: statementsData, error: statementsError } = await supabase
        .from('attribute_statements')
        .select(`
          id,
          statement,
          attribute_bank_id,
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



      console.log(responseMap);

      setSelectedEvaluation(evaluationData);
      setStatements(statementsData || []);
      setResponses(responseMap);

     
     
    } catch (error) {
      console.error('Error loading evaluation details:', error);
      toast.error(error.message || 'Failed to load evaluation details');
      setSelectedEvaluation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (statementId, optionId) => {
    setResponses(prev => ({
      ...prev,
      [statementId]: optionId
    }));
  };

  const handleSubmitEvaluation = async () => {
    try {
      setIsSubmitting(true);

      // Validate all responses
      const unanswered = statements.filter(stmt => !responses[stmt.id]);
      if (unanswered.length > 0) {
        toast.error('Please complete all questions before submitting');
        return;
      }

      console.log(responses);

      // Prepare response data
      const responseData = statements.map(statement => ({
        evaluation_id: selectedEvaluation.id,
        statement_id: statement.id,
        selected_option_id: responses[statement.id],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ));


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
    <div className="container mx-auto p-4 md:p-6">
      <h3 className="text-xl font-bold text-purple-800 mb-8">{ userCompany !== "" ? user.user_metadata?.full_name +" - "+ userCompany : ""}</h3>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {evaluations.map((evaluation) => {
          // console.log(evaluation);
          return (
            <div
              key={evaluation.id}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => fetchEvaluationDetails(evaluation.id)}
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
          );
        })}

        {evaluations.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-8">
            No pending evaluations found
          </div>
        )}
      </div>
        
      <Dialog 
        open={!!selectedEvaluation} 
        onOpenChange={(open) => !open && setSelectedEvaluation(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
            { selectedEvaluation?.status === 'completed' ? toast.warning("Already Evaluated") : <></>}
            {selectedEvaluation?.is_self_evaluator ? selectedEvaluation?.evaluation_assignments?.evaluation_name + ": Self Evaluation" : selectedEvaluation?.evaluation_assignments?.evaluation_name + ": Evaluate " +selectedEvaluation?.evaluation_assignments?.users?.full_name + " as " + user.user_metadata?.full_name }              
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Evaluating: {selectedEvaluation?.evaluation_assignments?.user_to_evaluate?.full_name}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-grow px-4">
            <div className="space-y-8 py-4">
              {statements.map((statement , index) => (
                <div 
                  key={statement.id}
                  className="bg-gray-50 rounded-lg p-6 shadow-inner"
                >
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-purple-800">
                      {(index + 1) + ". " +statement.statement}
                    </h4>
                    {/* <p className="text-gray-600 mt-2">
                      {statement.statement}
                    </p> */}
                  </div>

                  <RadioGroup
                    value={responses[statement.id]?.toString()}
                    onValueChange={(value) => handleOptionSelect(statement.id, value)}
                    className="space-y-3"
                  >
                    {statement.attribute_statement_options
                      ?.sort((a, b) => a.display_order - b.display_order)
                      .map((option) => (
                        <div 
                          key={option.id}
                          className="flex items-center space-x-3 bg-white p-4 rounded-md shadow-sm hover:bg-gray-50"
                        >
                          <RadioGroupItem 
                            value={option.id.toString()} 
                            id={`option-${statement.id}-${option.id}`}
                          />
                          <Label 
                            htmlFor={`option-${statement.id}-${option.id}`}
                            className="flex-1 text-gray-700 cursor-pointer"
                          >
                            {option.option_text}
                          </Label>
                  
                        </div>
                      ))}
                  </RadioGroup>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-4 mt-6 px-4 py-3 border-t">
            <Button
              variant="outline"
              onClick={() => setSelectedEvaluation(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEvaluation}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">↻</span>
                  Submitting...
                </>
              ) : (
                'Submit Evaluation'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserEvaluations;