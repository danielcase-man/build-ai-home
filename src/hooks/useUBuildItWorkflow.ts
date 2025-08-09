import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UBuildItWorkflowState, UBuildItStep } from '@/components/ubuildit/UBuildItWorkflowBar';

export const useUBuildItWorkflow = () => {
  const [loading, setLoading] = useState(false);

  const enableWorkflow = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const initialWorkflowState: UBuildItWorkflowState = {
        enabled: true,
        currentStep: 0,
        steps: [
          {
            id: 'ballpark-budget',
            name: 'Ballpark Budget',
            description: 'Determine your rough budget range and funding approach',
            status: 'in_progress',
            estimatedDuration: '1-2 weeks'
          },
          {
            id: 'site-review',
            name: 'Site Review',
            description: 'Analyze your lot conditions, setbacks, and site constraints',
            status: 'pending',
            estimatedDuration: '2-3 weeks'
          },
          {
            id: 'plan-development',
            name: 'Plan Development',
            description: 'Create detailed architectural plans and specifications',
            status: 'pending',
            estimatedDuration: '6-10 weeks'
          },
          {
            id: 'specifications',
            name: 'Specifications',
            description: 'Define materials, fixtures, and finish selections',
            status: 'pending',
            estimatedDuration: '3-4 weeks'
          },
          {
            id: 'estimated-budget',
            name: 'Estimated Budget',
            description: 'Get detailed cost estimates from contractors and suppliers',
            status: 'pending',
            estimatedDuration: '4-6 weeks'
          },
          {
            id: 'cost-review',
            name: 'Cost Review',
            description: 'Final budget analysis and value engineering decisions',
            status: 'pending',
            estimatedDuration: '2-3 weeks'
          }
        ],
        timeline: {
          startDate: new Date().toISOString(),
          totalDays: 140, // 117-223 day range, using middle estimate
          estimatedCompletion: new Date(Date.now() + 140 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      const { error } = await supabase
        .from('projects')
        .update({ ubuildit_workflow_state: initialWorkflowState })
        .eq('id', projectId);

      if (error) throw error;

      toast.success('UBuildIt workflow enabled successfully!');
      return initialWorkflowState;
    } catch (error: any) {
      console.error('Error enabling workflow:', error);
      toast.error('Failed to enable UBuildIt workflow');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const advanceStep = useCallback(async (projectId: string, stepId: string, currentWorkflowState: UBuildItWorkflowState) => {
    setLoading(true);
    try {
      const updatedSteps = currentWorkflowState.steps.map(step => {
        if (step.id === stepId) {
          return { ...step, status: 'completed' as const, completedAt: new Date().toISOString() };
        }
        return step;
      });

      // Find next step and mark as in_progress
      const currentStepIndex = updatedSteps.findIndex(step => step.id === stepId);
      if (currentStepIndex < updatedSteps.length - 1) {
        updatedSteps[currentStepIndex + 1].status = 'in_progress';
      }

      const updatedWorkflowState: UBuildItWorkflowState = {
        ...currentWorkflowState,
        steps: updatedSteps,
        currentStep: Math.min(currentWorkflowState.currentStep + 1, updatedSteps.length - 1)
      };

      const { error } = await supabase
        .from('projects')
        .update({ ubuildit_workflow_state: updatedWorkflowState })
        .eq('id', projectId);

      if (error) throw error;

      const completedStep = updatedSteps.find(step => step.id === stepId);
      toast.success(`Completed: ${completedStep?.name}`);
      return updatedWorkflowState;
    } catch (error: any) {
      console.error('Error advancing step:', error);
      toast.error('Failed to advance workflow step');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const disableWorkflow = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ ubuildit_workflow_state: null })
        .eq('id', projectId);

      if (error) throw error;

      toast.success('UBuildIt workflow disabled');
    } catch (error: any) {
      console.error('Error disabling workflow:', error);
      toast.error('Failed to disable UBuildIt workflow');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    enableWorkflow,
    advanceStep,
    disableWorkflow,
    loading
  };
};