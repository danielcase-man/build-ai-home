-- Add UBuildIt workflow state to projects table
ALTER TABLE projects ADD COLUMN ubuildit_workflow_state JSONB DEFAULT NULL;

-- Add comment to explain the field structure
COMMENT ON COLUMN projects.ubuildit_workflow_state IS 'Stores UBuildIt 6-step workflow progress: {enabled: boolean, currentStep: number, steps: [{name: string, status: string, completedAt: timestamp}], timeline: object}';

-- Create index for efficient querying
CREATE INDEX idx_projects_ubuildit_workflow_enabled ON projects USING GIN ((ubuildit_workflow_state->>'enabled')) WHERE ubuildit_workflow_state IS NOT NULL;