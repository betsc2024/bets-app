import React, { forwardRef, useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';

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

  // Auto-save logic
  useEffect(() => {
    const saveResponses = async () => {
      if (!hasUnsavedChanges) return;
      
      setIsSaving(true);
      try {
        // Simulating API call
        await new Promise(resolve => setTimeout(resolve, 1000));
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
  }, [responses, hasUnsavedChanges]);

  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [responses]);

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          {isSaving ? (
            <span className="text-yellow-600">Saving...</span>
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
            Cancel
          </Button>
          {rightContent}
        </div>
      </div>
    </div>
  );
});

EvaluationCheckpoint.displayName = 'EvaluationCheckpoint';

export default EvaluationCheckpoint;