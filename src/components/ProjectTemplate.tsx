import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  Home,
  Users,
  FileText,
  Wrench,
  MapPin
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  budget: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  duration: string;
  dependencies?: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  startDate?: string;
  endDate?: string;
  progress: number;
}

interface BudgetLineItem {
  id: string;
  category: string;
  item: string;
  budgetAmount: number;
  actualAmount: number;
  vendor?: string;
  status: 'planned' | 'approved' | 'ordered' | 'delivered' | 'paid';
}

const newHomeConstructionPhases: ProjectPhase[] = [
  {
    id: "land-prep",
    name: "Land Preparation",
    description: "Site survey, soil testing, permits",
    duration: "2-4 weeks",
    status: "completed",
    progress: 100,
    startDate: "2024-01-15",
    endDate: "2024-02-12"
  },
  {
    id: "foundation",
    name: "Foundation",
    description: "Excavation, footings, concrete pour",
    duration: "1-2 weeks",
    dependencies: ["land-prep"],
    status: "completed",
    progress: 100,
    startDate: "2024-02-15",
    endDate: "2024-02-28"
  },
  {
    id: "framing",
    name: "Framing",
    description: "Structural framing, roof installation",
    duration: "2-3 weeks",
    dependencies: ["foundation"],
    status: "in-progress",
    progress: 75,
    startDate: "2024-03-01",
    endDate: "2024-03-22"
  },
  {
    id: "mechanical",
    name: "Mechanical Systems",
    description: "Plumbing, electrical, HVAC rough-in",
    duration: "2-3 weeks",
    dependencies: ["framing"],
    status: "pending",
    progress: 0
  },
  {
    id: "insulation",
    name: "Insulation & Drywall",
    description: "Insulation installation, drywall hanging and finishing",
    duration: "2 weeks",
    dependencies: ["mechanical"],
    status: "pending",
    progress: 0
  },
  {
    id: "flooring",
    name: "Flooring",
    description: "Hardwood, tile, carpet installation",
    duration: "1-2 weeks",
    dependencies: ["insulation"],
    status: "pending",
    progress: 0
  },
  {
    id: "interior",
    name: "Interior Finishing",
    description: "Paint, trim, cabinets, fixtures",
    duration: "3-4 weeks",
    dependencies: ["flooring"],
    status: "pending",
    progress: 0
  },
  {
    id: "final",
    name: "Final Inspections",
    description: "Final walkthrough, punch list, occupancy permit",
    duration: "1 week",
    dependencies: ["interior"],
    status: "pending",
    progress: 0
  }
];

const sampleBudgetItems: BudgetLineItem[] = [
  {
    id: "1",
    category: "Foundation",
    item: "Concrete Foundation",
    budgetAmount: 15000,
    actualAmount: 14500,
    vendor: "ABC Concrete Co.",
    status: "paid"
  },
  {
    id: "2",
    category: "Framing",
    item: "Lumber Package",
    budgetAmount: 25000,
    actualAmount: 26200,
    vendor: "Home Depot Pro",
    status: "delivered"
  },
  {
    id: "3",
    category: "Framing",
    item: "Framing Labor",
    budgetAmount: 12000,
    actualAmount: 0,
    vendor: "Johnson Framing Crew",
    status: "approved"
  },
  {
    id: "4",
    category: "Mechanical",
    item: "Plumbing Rough-in",
    budgetAmount: 8000,
    actualAmount: 0,
    vendor: "Quick Fix Plumbing",
    status: "planned"
  },
  {
    id: "5",
    category: "Mechanical",
    item: "Electrical Rough-in",
    budgetAmount: 9500,
    actualAmount: 0,
    vendor: "Spark Electric",
    status: "planned"
  }
];

const ProjectTemplate = () => {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const fetchProjectData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        toast.error('Failed to load project');
        return;
      }

      setProject(projectData);

      // Fetch project phases
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', id)
        .order('phase_order');

      if (phasesError) {
        console.error('Error fetching phases:', phasesError);
      } else {
        setPhases(phasesData || []);
      }

    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-primary text-primary-foreground';
      case 'delayed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center mb-8">
          <Skeleton className="h-6 w-32 mx-auto mb-4" />
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-2 w-full mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center p-12">
        <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
        <p className="text-muted-foreground">The project you're looking for doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  const completedPhases = phases.filter(phase => phase.status === 'completed').length;
  const projectProgress = phases.length > 0 ? (completedPhases / phases.length) * 100 : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Project Header */}
      <div className="text-center mb-8">
        <Badge variant="secondary" className="text-primary bg-primary/10 border-primary/20 mb-4">
          <Home className="w-4 h-4 mr-2" />
          {project.status.replace('_', ' ')}
        </Badge>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {project.name}
        </h1>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{project.location}</span>
          {project.start_date && (
            <>
              <span>•</span>
              <span>Started {formatDate(project.start_date)}</span>
            </>
          )}
        </div>
        {project.description && (
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            {project.description}
          </p>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{Math.round(projectProgress)}%</div>
            <Progress value={projectProgress} className="h-2 mb-2" />
            <p className="text-sm text-muted-foreground">
              {completedPhases} of {phases.length} phases complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-primary" />
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {project.budget ? `$${(project.budget / 1000).toFixed(0)}k` : 'Not set'}
            </div>
            <p className="text-sm text-muted-foreground">
              Total project budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <Clock className="w-4 h-4 mr-2 text-primary" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {project.end_date ? formatDate(project.end_date) : 'TBD'}
            </div>
            <p className="text-sm text-muted-foreground">Target completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Phases */}
      {phases.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              Project Phases
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {phases.map((phase) => (
              <div key={phase.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{phase.phase_name}</h3>
                    {phase.estimated_duration_days && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Duration: {phase.estimated_duration_days} days
                      </p>
                    )}
                  </div>
                  <Badge className={getStatusColor(phase.status)}>
                    {phase.status === 'in_progress' && <Clock className="w-3 h-3 mr-1" />}
                    {phase.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {phase.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                {(phase.start_date || phase.end_date) && (
                  <div className="text-xs text-muted-foreground">
                    {phase.start_date ? formatDate(phase.start_date) : 'TBD'} - {phase.end_date ? formatDate(phase.end_date) : 'TBD'}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No phases yet</h3>
            <p className="text-muted-foreground mb-6">
              Project phases will appear here once they're added to your project.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center pt-6">
        <Button variant="default">
          <Wrench className="w-4 h-4 mr-2" />
          Manage Project
        </Button>
        <Button variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
      </div>
    </div>
  );
};

export default ProjectTemplate;