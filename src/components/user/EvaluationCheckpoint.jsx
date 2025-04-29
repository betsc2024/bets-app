import React, { forwardRef, useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

const EvaluationCheckpoint = forwardRef(({ 
  evaluationId, 
  responses, 
  setResponses, 
  isSubmitting, 
  onCancel, 
  onSubmit,
  rightContent 
}, ref) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Expose hasUnsavedChanges to parent through ref
  React.useImperativeHandle(ref, () => ({
    hasUnsavedChanges
  }));

  // Auto-save logic
  useEffect(() => {
    const saveResponses = async () => {
      if (!hasUnsavedChanges || !evaluationId) return;
      
      setIsSaving(true);
      try {
        // Convert responses to array format for upsert
        const responseData = Object.entries(responses).map(([statementId, selectedOptionId]) => ({
          evaluation_id: evaluationId,
          statement_id: statementId,
          selected_option_id: selectedOptionId,
          last_updated: new Date().toISOString()
        }));

        // Delete existing responses for these statements
        const statementIds = Object.keys(responses);
        if (statementIds.length > 0) {
          const { error: deleteError } = await supabase
            .from('draft_responses')
            .delete()
            .eq('evaluation_id', evaluationId)
            .in('statement_id', statementIds);

          if (deleteError) throw deleteError;
        }

        // Then insert new responses
        const { error } = await supabase
          .from('draft_responses')
          .insert(responseData);

        if (error) throw error;

        setLastSavedTime(new Date());
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to save responses:', error);
      } finally {
        setIsSaving(false);
      }
    };

    const timer = setTimeout(saveResponses, 2000);
    return () => clearTimeout(timer);
  }, [responses, hasUnsavedChanges, evaluationId]);

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [responses]);

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          {isSaving ? (
            <span className="text-yellow-600 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : hasUnsavedChanges ? (
            <span className="text-yellow-600">Unsaved changes</span>
          ) : lastSavedTime ? (
            <span className="text-green-600">✓ Saved at {lastSavedTime.toLocaleTimeString()}</span>
          ) : null}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onCancel}
            disabled={isSaving || isSubmitting}
          >
            Exit
          </Button>
          {rightContent}
        </div>
      </div>
    </div>
  );
});

EvaluationCheckpoint.displayName = 'EvaluationCheckpoint';

export default EvaluationCheckpoint;