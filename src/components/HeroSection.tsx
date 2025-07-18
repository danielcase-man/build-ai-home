import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  FileText, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  PlayCircle 
} from "lucide-react";
import heroImage from "@/assets/hero-construction.jpg";

const HeroSection = () => {
  const stats = [
    { label: "Time Saved", value: "95%", icon: Clock },
    { label: "Compliance Rate", value: "99%", icon: TrendingUp },
    { label: "Projects Completed", value: "1,200+", icon: FileText }
  ];

  const features = [
    { icon: Search, label: "AI Research", description: "Automated lender & vendor research" },
    { icon: FileText, label: "Document Generation", description: "Bank-ready loan packages" },
    { icon: TrendingUp, label: "Project Management", description: "End-to-end construction tracking" }
  ];

  return (
    <section className="relative min-h-screen flex items-center bg-gradient-hero overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Modern construction site" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/40" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Hero Content */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <Badge variant="secondary" className="text-primary bg-primary/10 border-primary/20">
                <span className="w-2 h-2 bg-primary rounded-full animate-glow mr-2" />
                AI-Powered Construction Platform
              </Badge>
              
              <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
                Automate Your{" "}
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Construction Loans
                </span>{" "}
                with AI
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl">
                Transform weeks of loan documentation into minutes. Our AI researches lenders, 
                generates bank-ready packages, and manages your entire construction project 
                from financing to completion.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="construction" size="xl" className="group">
                Start AI Research
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="hero" size="xl" className="group">
                <PlayCircle className="w-5 h-5" />
                Watch Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border/50">
              {stats.map((stat, index) => (
                <div key={stat.label} className="text-center space-y-2 animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <div className="flex items-center justify-center space-x-2">
                    <stat.icon className="w-5 h-5 text-primary" />
                    <span className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features Preview */}
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-card border border-border/50 p-6">
              <h3 className="text-xl font-semibold text-foreground mb-6">
                Complete Construction Solution
              </h3>
              
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div 
                    key={feature.label} 
                    className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                  >
                    <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{feature.label}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Success Metric */}
            <div className="bg-gradient-primary rounded-xl p-6 text-center shadow-hero">
              <div className="text-white/90 text-sm font-medium mb-2">Average Time Savings</div>
              <div className="text-3xl font-bold text-white mb-1">45 Hours</div>
              <div className="text-white/80 text-sm">Per construction loan package</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;