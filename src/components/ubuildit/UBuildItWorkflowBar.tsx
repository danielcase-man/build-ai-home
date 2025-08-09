import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  DollarSign,
  FileText,
  Settings,
  Calculator,
  Eye
} from 'lucide-react';

export interface UBuildItStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
  estimatedDuration: string;
}

export interface UBuildItWorkflowState {
  enabled: boolean;
  currentStep: number;
  steps: UBuildItStep[];
  timeline?: {
    startDate?: string;
    estimatedCompletion?: string;
    totalDays: number;
  };
}

export interface UBuildItWorkflowBarProps {
  project: {
    id: string;
    name: string;
    ubuildit_workflow_state?: UBuildItWorkflowState | null;
  };
  onEnableWorkflow?: () => void;
  onAdvanceStep?: (stepId: string) => void;
}

const UBUILDIT_STEPS: UBuildItStep[] = [
  {
    id: 'ballpark-budget',
    name: 'Ballpark Budget',
    description: 'Determine your rough budget range and funding approach',
    status: 'pending',
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
];

const getStepIcon = (stepId: string, status: string) => {
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (status === 'in_progress') return <Clock className="h-5 w-5 text-primary" />;
  
  const icons = {
    'ballpark-budget': <DollarSign className="h-5 w-5 text-muted-foreground" />,
    'site-review': <Eye className="h-5 w-5 text-muted-foreground" />,
    'plan-development': <FileText className="h-5 w-5 text-muted-foreground" />,
    'specifications': <Settings className="h-5 w-5 text-muted-foreground" />,
    'estimated-budget': <Calculator className="h-5 w-5 text-muted-foreground" />,
    'cost-review': <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
  };
  
  return icons[stepId as keyof typeof icons] || <Circle className="h-5 w-5 text-muted-foreground" />;
};

export const UBuildItWorkflowBar: React.FC<UBuildItWorkflowBarProps> = ({ 
  project, 
  onEnableWorkflow,
  onAdvanceStep 
}) => {
  const workflowState = project.ubuildit_workflow_state;

  // Don't show if workflow is not enabled
  if (!workflowState?.enabled) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            UBuildIt Planning Process
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Enable the structured UBuildIt 6-step planning process to guide your project from initial budget through detailed cost analysis.
          </p>
          <Button onClick={onEnableWorkflow} variant="outline">
            Enable UBuildIt Workflow
          </Button>
        </CardContent>
      </Card>
    );
  }

  const steps = workflowState.steps.length > 0 ? workflowState.steps : UBUILDIT_STEPS;
  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const currentStep = steps.find(step => step.status === 'in_progress');
  const progress = (completedSteps / steps.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            UBuildIt Planning Process
          </CardTitle>
          <Badge variant="secondary">
            {completedSteps}/{steps.length} Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {workflowState.timeline?.estimatedCompletion && (
            <p className="text-xs text-muted-foreground mt-2">
              Est. completion: {new Date(workflowState.timeline.estimatedCompletion).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
              {getStepIcon(step.id, step.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{step.name}</h4>
                  <span className="text-xs text-muted-foreground">{step.estimatedDuration}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {step.status === 'in_progress' && onAdvanceStep && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAdvanceStep(step.id)}
                >
                  Complete
                </Button>
              )}
            </div>
          ))}
        </div>

        {currentStep && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-lg">
            <h4 className="text-sm font-medium text-primary mb-1">Current Step: {currentStep.name}</h4>
            <p className="text-xs text-muted-foreground">{currentStep.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};