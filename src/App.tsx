import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProjectTemplate from "./components/ProjectTemplate";
import { ProjectIntake } from "./components/ProjectIntake";
import { ProjectDashboard } from "./components/ProjectDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import PreConstructionPlanning from "./pages/PreConstructionPlanning";
import VendorResults from "./pages/VendorResults";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/projects" element={<ProtectedRoute><ProjectDashboard /></ProtectedRoute>} />
            <Route path="/project/new" element={<ProtectedRoute><ProjectIntake /></ProtectedRoute>} />
            <Route path="/project/:id" element={<ProtectedRoute><ProjectTemplate /></ProtectedRoute>} />
            <Route path="/project/:id/pre-construction" element={<ProtectedRoute><PreConstructionPlanning /></ProtectedRoute>} />
            <Route path="/project/:id/vendors" element={<ProtectedRoute><VendorResults /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
