import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import AIResearchDashboard from "@/components/AIResearchDashboard";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <HeroSection />
      {user && (
        <>
          <AIResearchDashboard />
          <ProjectDashboard />
        </>
      )}
    </div>
  );
};

export default Index;
