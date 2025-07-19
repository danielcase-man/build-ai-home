import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, DollarSign, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProjectFormData {
  name: string;
  description: string;
  location: string;
  zipCode: string;
  budget: string;
  startDate: string;
  endDate: string;
  projectType: string;
}

export const ProjectIntake = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    location: '',
    zipCode: '',
    budget: '',
    startDate: '',
    endDate: '',
    projectType: 'new_home_construction'
  });

  const projectTypes = [
    { value: 'new_home_construction', label: 'New Home Construction' },
    { value: 'major_renovation', label: 'Major Renovation' },
    { value: 'addition', label: 'Home Addition' },
    { value: 'custom_build', label: 'Custom Home Build' }
  ];

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const createProject = async () => {
    console.log('User object:', user);
    console.log('User ID:', user?.id);
    
    if (!user) {
      toast.error('Please sign in to create a project');
      return;
    }

    setLoading(true);
    
    try {
      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description,
          location: formData.location,
          budget: parseFloat(formData.budget) || null,
          start_date: formData.startDate || null,
          end_date: formData.endDate || null,
          status: 'planning',
          owner_id: user.id
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create default project phases for new home construction
      const defaultPhases = [
        { name: 'Pre-Construction Planning & Design', order: 1, duration: 30 },
        { name: 'Site Work & Land Preparation', order: 2, duration: 14 },
        { name: 'Foundation & Structural Work', order: 3, duration: 21 },
        { name: 'Exterior Shell & Weather Protection', order: 4, duration: 28 },
        { name: 'HVAC, Plumbing, Electrical & Mechanical', order: 5, duration: 21 },
        { name: 'Interior Finishes & Final Systems', order: 6, duration: 35 },
        { name: 'Utility Connections & Infrastructure', order: 7, duration: 7 },
        { name: 'Landscaping & Exterior Improvements', order: 8, duration: 14 },
        { name: 'Final Inspections & Move-In', order: 9, duration: 7 }
      ];

      const { error: phasesError } = await supabase
        .from('project_phases')
        .insert(
          defaultPhases.map(phase => ({
            project_id: project.id,
            phase_name: phase.name,
            phase_order: phase.order,
            estimated_duration_days: phase.duration,
            status: 'not_started'
          }))
        );

      if (phasesError) throw phasesError;

      toast.success('Project created successfully!');
      navigate(`/project/${project.id}`);
      
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.name && formData.zipCode && formData.projectType;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Construction Project</h1>
        <p className="text-muted-foreground">
          Start your home construction journey with our comprehensive project management system
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Project Information
            </CardTitle>
            <CardDescription>
              Tell us about your construction project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Smith Family Dream Home"
              />
            </div>

            <div>
              <Label htmlFor="projectType">Project Type *</Label>
              <Select
                value={formData.projectType}
                onValueChange={(value) => handleInputChange('projectType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe your project goals, style preferences, special requirements..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location & Budget
            </CardTitle>
            <CardDescription>
              Help us find local vendors and provide accurate estimates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="location">Project Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="e.g., Austin, Texas"
              />
            </div>

            <div>
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => handleInputChange('zipCode', e.target.value)}
                placeholder="e.g., 78701"
                maxLength={5}
              />
            </div>

            <div>
              <Label htmlFor="budget">Estimated Budget</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', e.target.value)}
                  placeholder="500000"
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
            <CardDescription>
              Set your project timeline (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">Target Completion</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
            <CardDescription>
              After creating your project, you'll be able to:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">AI Research</Badge>
                <span className="text-sm">Find local vendors and suppliers</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Timeline</Badge>
                <span className="text-sm">Track project phases and milestones</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Budget</Badge>
                <span className="text-sm">Monitor costs and get estimates</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Team</Badge>
                <span className="text-sm">Build your contractor network</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          onClick={createProject}
          disabled={!isFormValid || loading}
          size="lg"
          className="min-w-48"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Project...
            </>
          ) : (
            'Create Project & Start Research'
          )}
        </Button>
      </div>
    </div>
  );
};