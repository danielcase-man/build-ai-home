import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  HardHat, 
  Search, 
  FileText, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  Home
} from "lucide-react";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { icon: Home, label: "Dashboard", href: "#dashboard" },
    { icon: Search, label: "AI Research", href: "#research" },
    { icon: FileText, label: "Documents", href: "#documents" },
    { icon: BarChart3, label: "Projects", href: "#projects" },
    { icon: Settings, label: "Settings", href: "#settings" }
  ];

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-primary p-2 rounded-lg shadow-construction">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Home Builder Pro</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Construction</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center space-x-3">
            <Button variant="construction" size="sm">
              Start Research
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  className="justify-start space-x-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Button>
              ))}
              <div className="pt-2">
                <Button variant="construction" className="w-full">
                  Start Research
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;