import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { toast } from 'sonner';
import { supabase } from '../../supabase';

const EvaluationCheckpoint = forwardRef(({ 
  evaluationId, 
  responses, 
  setResponses, 
  isSubmitting, 
  onCancel, 
  onSubmit 
}, ref) => {
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [initialResponses, setInitialResponses] = useState(null);

  // Expose hasUnsavedChanges to parent
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges
  }));

  // Load existing draft responses
  useEffect(() => {
    const loadDraftResponses = async () => {
      if (!evaluationId) return;

      try {
        const { data: draftData, error } = await supabase
          .from('draft_responses')
          .select('statement_id, selected_option_id')
          .eq('evaluation_id', evaluationId);

        if (error) throw error;

        if (draftData?.length > 0) {
          const loadedResponses = draftData.reduce((acc, { statement_id, selected_option_id }) => ({
            ...acc,
            [statement_id]: selected_option_id
          }), {});
          
          // Set both initial and current responses
          setInitialResponses(loadedResponses);
          setResponses(loadedResponses);
          setLastSavedTime(new Date());
        } else {
          // No draft responses found
          setInitialResponses({});
        }
      } catch (error) {
        console.error('Error loading draft responses:', error);
        toast.error('Failed to load saved progress');
      }
    };

    // Reset states when evaluation changes
    setInitialResponses(null);
    setHasUnsavedChanges(false);
    setLastSavedTime(null);
    loadDraftResponses();
  }, [evaluationId, setResponses]);

  // Watch for changes in responses
  useEffect(() => {
    // Skip if initial responses haven't been loaded yet
    if (initialResponses === null) return;

    // Compare current responses with initial responses
    const hasChanges = Object.keys(responses).some(key => 
      responses[key] !== (initialResponses[key] || null)
    ) || Object.keys(initialResponses).some(key => 
      !(key in responses)
    );

    if (hasChanges) {
      console.log('Responses changed from initial state, setting unsaved changes');
      setHasUnsavedChanges(true);
    }
  }, [responses, initialResponses]);

  // Auto-save timer
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    console.log('Auto-save timer triggered');
    const timer = setTimeout(saveCheckpoint, 2000);
    return () => clearTimeout(timer);
  }, [hasUnsavedChanges]);

  const saveCheckpoint = async () => {
    if (!evaluationId || isSaving) return;

    try {
      console.log('Starting save checkpoint');
      setIsSaving(true);
      
      // Get all option IDs as an array
      const optionIds = Object.values(responses);
      console.log('Option IDs to verify:', optionIds);
      
      // First verify that all option IDs exist
      const { data: validOptions, error: verifyError } = await supabase
        .from('attribute_statement_options')
        .select('id')
        .in('id', optionIds);

      if (verifyError) throw verifyError;

      // Only save responses with valid option IDs
      const validOptionIds = new Set(validOptions.map(opt => opt.id));
      const validResponses = Object.entries(responses)
        .filter(([_, optionId]) => validOptionIds.has(optionId))
        .map(([statementId, optionId]) => ({
          evaluation_id: evaluationId,
          statement_id: statementId,
          selected_option_id: optionId,
          last_updated: new Date().toISOString()
        }));

      console.log('Valid responses to save:', validResponses.length);
      if (validResponses.length === 0) {
        console.log('No valid responses to save. Responses:', responses);
        console.log('Valid option IDs:', Array.from(validOptionIds));
        return;
      }

      // Delete existing drafts first
      await supabase
        .from('draft_responses')
        .delete()
        .eq('evaluation_id', evaluationId);

      // Insert new drafts
      const { error } = await supabase
        .from('draft_responses')
        .insert(validResponses);

      if (error) throw error;
      
      const now = new Date();
      console.log('Save successful, updating UI at:', now);
      setHasUnsavedChanges(false);
      setLastSavedTime(now);
      setInitialResponses(responses); // Update initial responses after successful save
      toast.success('Progress auto-saved');
    } catch (error) {
      console.error('Error saving progress:', error);
      toast.error('Failed to auto-save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {isSaving ? (
            <span className="flex items-center">
              <Loader2 className="animate-spin h-3 w-3 mr-2" />
              Auto-saving...
            </span>
          ) : hasUnsavedChanges ? (
            <span className="text-yellow-600">Unsaved changes</span>
          ) : lastSavedTime ? (
            <span className="text-green-600">✓ Saved at {lastSavedTime.toLocaleTimeString()}</span>
          ) : null}
        </div>
        <div className="space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onCancel}
            disabled={isSaving || isSubmitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={isSaving || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin h-3 w-3 mr-2" />
                Submitting...
              </>
            ) : (
              'Submit Evaluation'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default EvaluationCheckpoint;
