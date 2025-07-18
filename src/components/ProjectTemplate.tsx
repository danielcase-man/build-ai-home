import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  Home,
  Users,
  FileText,
  Wrench
} from "lucide-react";

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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in-progress': return 'bg-primary text-primary-foreground';
      case 'delayed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getBudgetStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-success text-success-foreground';
      case 'delivered': return 'bg-primary text-primary-foreground';
      case 'approved': return 'bg-warning text-warning-foreground';
      case 'ordered': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const totalBudget = sampleBudgetItems.reduce((sum, item) => sum + item.budgetAmount, 0);
  const totalSpent = sampleBudgetItems.reduce((sum, item) => sum + item.actualAmount, 0);
  const budgetProgress = (totalSpent / totalBudget) * 100;

  const completedPhases = newHomeConstructionPhases.filter(phase => phase.status === 'completed').length;
  const projectProgress = (completedPhases / newHomeConstructionPhases.length) * 100;

  return (
    <div className="space-y-6 p-6">
      {/* Project Header */}
      <div className="text-center mb-8">
        <Badge variant="secondary" className="text-primary bg-primary/10 border-primary/20 mb-4">
          <Home className="w-4 h-4 mr-2" />
          New Home Construction
        </Badge>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Johnson Family Custom Home
        </h1>
        <p className="text-muted-foreground">Austin, TX • Started January 2024</p>
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
              {completedPhases} of {newHomeConstructionPhases.length} phases complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-primary" />
              Budget Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              ${(totalSpent / 1000).toFixed(0)}k / ${(totalBudget / 1000).toFixed(0)}k
            </div>
            <Progress value={budgetProgress} className="h-2 mb-2" />
            <p className="text-sm text-muted-foreground">
              {Math.round(budgetProgress)}% of budget used
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
            <div className="text-2xl font-bold mb-2 text-warning">2 weeks</div>
            <p className="text-sm text-muted-foreground">behind schedule</p>
            <p className="text-xs text-muted-foreground mt-1">Est. completion: June 2024</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Timeline Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              Project Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {newHomeConstructionPhases.map((phase) => (
              <div key={phase.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{phase.name}</h3>
                    <p className="text-sm text-muted-foreground">{phase.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Duration: {phase.duration}</p>
                  </div>
                  <Badge className={getStatusColor(phase.status)}>
                    {phase.status === 'in-progress' && <Clock className="w-3 h-3 mr-1" />}
                    {phase.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {phase.status.replace('-', ' ')}
                  </Badge>
                </div>
                
                {phase.progress > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{phase.progress}%</span>
                    </div>
                    <Progress value={phase.progress} className="h-2" />
                  </div>
                )}

                {phase.startDate && (
                  <div className="text-xs text-muted-foreground">
                    {phase.startDate} - {phase.endDate || 'TBD'}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Budget Tracker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-primary" />
              Budget Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sampleBudgetItems.map((item) => (
              <div key={item.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{item.item}</h3>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                    {item.vendor && (
                      <p className="text-xs text-muted-foreground flex items-center mt-1">
                        <Users className="w-3 h-3 mr-1" />
                        {item.vendor}
                      </p>
                    )}
                  </div>
                  <Badge className={getBudgetStatusColor(item.status)}>
                    {item.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Budget</div>
                    <div className="font-medium">${item.budgetAmount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Actual</div>
                    <div className={`font-medium ${
                      item.actualAmount > item.budgetAmount ? 'text-destructive' :
                      item.actualAmount > 0 ? 'text-success' : 'text-muted-foreground'
                    }`}>
                      ${item.actualAmount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="pt-4 border-t">
              <Button variant="outline" className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                Add Budget Item
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center pt-6">
        <Button variant="default">
          <Wrench className="w-4 h-4 mr-2" />
          Update Phase Status
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