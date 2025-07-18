import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import AIResearchDashboard from "@/components/AIResearchDashboard";
import ProjectDashboard from "@/components/ProjectDashboard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <HeroSection />
      <AIResearchDashboard />
      <ProjectDashboard />
    </div>
  );
};

export default Index;
