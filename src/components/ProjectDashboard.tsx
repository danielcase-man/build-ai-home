import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Camera,
  MessageSquare
} from "lucide-react";
import dashboardPreview from "@/assets/dashboard-preview.jpg";

const ProjectDashboard = () => {
  const activeProjects = [
    {
      id: 1,
      name: "Johnson Family Custom Home",
      location: "Austin, TX",
      progress: 67,
      budget: 850000,
      spent: 570000,
      timeline: "3 months behind",
      status: "In Progress",
      phase: "Framing",
      dueDate: "March 2024"
    },
    {
      id: 2, 
      name: "Downtown Office Complex",
      location: "Denver, CO",
      progress: 34,
      budget: 2500000,
      spent: 850000,
      timeline: "On schedule",
      status: "In Progress", 
      phase: "Foundation",
      dueDate: "July 2024"
    },
    {
      id: 3,
      name: "Riverside Townhomes",
      location: "Portland, OR", 
      progress: 89,
      budget: 1200000,
      spent: 1100000,
      timeline: "2 weeks ahead",
      status: "Near Completion",
      phase: "Finishing",
      dueDate: "January 2024"
    }
  ];

  const recentActivities = [
    {
      type: "milestone",
      message: "Foundation inspection passed for Johnson Custom Home",
      time: "2 hours ago",
      icon: CheckCircle2,
      color: "text-success"
    },
    {
      type: "budget",
      message: "Budget alert: Downtown Office Complex 85% spent",
      time: "4 hours ago", 
      icon: AlertTriangle,
      color: "text-warning"
    },
    {
      type: "photo",
      message: "New progress photos uploaded for Riverside Townhomes",
      time: "6 hours ago",
      icon: Camera,
      color: "text-primary"
    },
    {
      type: "message",
      message: "Crew message: Electrical work starting Monday",
      time: "1 day ago",
      icon: MessageSquare,
      color: "text-secondary"
    }
  ];

  const todaysTasks = [
    { task: "Electrical inspection - Johnson Home", time: "9:00 AM", priority: "high" },
    { task: "Material delivery - Downtown Complex", time: "11:30 AM", priority: "medium" },
    { task: "Weekly team meeting", time: "2:00 PM", priority: "low" },
    { task: "Budget review - Riverside project", time: "4:00 PM", priority: "medium" }
  ];

  return (
    <section id="projects" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="text-primary bg-primary/10 border-primary/20 mb-4">
            Project Management
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Complete Project Control
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Track every aspect of your construction projects from timeline to budget, 
            with real-time updates and intelligent insights.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dashboard Preview */}
            <Card className="shadow-card overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span>Project Dashboard Preview</span>
                </CardTitle>
                <CardDescription>
                  Real-time project management interface with Gantt charts and progress tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative">
                  <img 
                    src={dashboardPreview} 
                    alt="Project management dashboard interface"
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <Button variant="construction" className="w-full">
                      Open Project Dashboard
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Projects */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>Active Projects</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {activeProjects.map((project) => (
                  <div key={project.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">{project.location}</p>
                      </div>
                      <Badge 
                        variant={project.status === "Near Completion" ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {project.phase}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-foreground font-medium">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Budget</div>
                          <div className="font-medium text-foreground">
                            ${(project.spent/1000)}k / ${(project.budget/1000)}k
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Timeline</div>
                          <div className={`font-medium ${
                            project.timeline.includes('behind') ? 'text-destructive' :
                            project.timeline.includes('ahead') ? 'text-success' : 'text-foreground'
                          }`}>
                            {project.timeline}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Due Date</div>
                          <div className="font-medium text-foreground">{project.dueDate}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Today's Tasks */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>Today's Tasks</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todaysTasks.map((task, index) => (
                  <div key={index} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${
                      task.priority === 'high' ? 'bg-destructive' :
                      task.priority === 'medium' ? 'bg-warning' : 'bg-success'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{task.task}</div>
                      <div className="text-xs text-muted-foreground">{task.time}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <activity.icon className={`w-4 h-4 mt-0.5 ${activity.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <span>Quick Stats</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">$4.55M</div>
                  <div className="text-sm text-muted-foreground">Total Active Budget</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <div className="text-lg font-bold text-primary">3</div>
                    <div className="text-xs text-muted-foreground">Active Projects</div>
                  </div>
                  <div className="p-3 bg-success/5 rounded-lg">
                    <div className="text-lg font-bold text-success">12</div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProjectDashboard;