import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Building2, 
  Phone, 
  Mail, 
  Download, 
  Star,
  TrendingUp,
  FileText,
  Users
} from "lucide-react";

const AIResearchDashboard = () => {
  const [isResearching, setIsResearching] = useState(false);
  const [projectLocation, setProjectLocation] = useState("");
  const [projectBudget, setProjectBudget] = useState("");

  const handleStartResearch = () => {
    setIsResearching(true);
    // Simulate API call
    setTimeout(() => setIsResearching(false), 3000);
  };

  const lenderResults = [
    {
      name: "First National Construction Bank",
      rate: "6.25%",
      maxLoan: "$2.5M",
      rating: 4.8,
      contact: "+1 (555) 123-4567",
      email: "construction@fnbank.com",
      specialties: ["Custom Homes", "Commercial"],
      processingTime: "14 days"
    },
    {
      name: "Builder's Capital Partners",
      rate: "6.45%", 
      maxLoan: "$5M",
      rating: 4.6,
      contact: "+1 (555) 987-6543",
      email: "loans@buildcap.com",
      specialties: ["Luxury Homes", "Multi-Unit"],
      processingTime: "21 days"
    },
    {
      name: "Regional Development Credit Union",
      rate: "5.95%",
      maxLoan: "$1.5M",
      rating: 4.4,
      contact: "+1 (555) 456-7890", 
      email: "info@rdcu.org",
      specialties: ["First-Time Builders", "Green Building"],
      processingTime: "28 days"
    }
  ];

  const vendorResults = [
    {
      name: "Premier Concrete Solutions",
      category: "Concrete & Foundation",
      rating: 4.9,
      distance: "2.3 miles",
      contact: "+1 (555) 111-2222",
      price: "$45-65/sq ft",
      specialties: ["Foundations", "Decorative Concrete"]
    },
    {
      name: "Elite Framing Contractors",
      category: "Framing",
      rating: 4.7,
      distance: "5.1 miles", 
      contact: "+1 (555) 333-4444",
      price: "$8-12/sq ft",
      specialties: ["Custom Framing", "Steel Frame"]
    },
    {
      name: "Modern Electrical Systems",
      category: "Electrical",
      rating: 4.8,
      distance: "3.7 miles",
      contact: "+1 (555) 555-6666",
      price: "$3-8/sq ft",
      specialties: ["Smart Home", "Solar Ready"]
    }
  ];

  const regulationResults = [
    {
      title: "Building Permit Requirements",
      status: "Required",
      authority: "City Planning Department",
      timeline: "4-6 weeks",
      cost: "$2,500 - $5,000",
      requirements: ["Architectural plans", "Site survey", "Environmental review"]
    },
    {
      title: "Zoning Compliance",
      status: "Verified",
      authority: "Zoning Board",
      timeline: "2-3 weeks", 
      cost: "$500 - $1,200",
      requirements: ["Setback verification", "Height restrictions", "Land use approval"]
    },
    {
      title: "Environmental Impact Assessment",
      status: "Conditional",
      authority: "Environmental Protection Agency",
      timeline: "6-8 weeks",
      cost: "$3,000 - $8,000", 
      requirements: ["Soil testing", "Water impact study", "Wildlife assessment"]
    }
  ];

  return (
    <section id="research" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="text-primary bg-primary/10 border-primary/20 mb-4">
            AI Research Engine
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Intelligent Construction Research
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our AI instantly researches lenders, vendors, and regulations for your specific project location and requirements.
          </p>
        </div>

        {/* Research Input */}
        <Card className="mb-8 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-primary" />
              <span>Project Research</span>
            </CardTitle>
            <CardDescription>
              Enter your project details to get comprehensive AI-powered research results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Location</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="City, State"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Budget</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="$500,000"
                    value={projectBudget}
                    onChange={(e) => setProjectBudget(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Project Type</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Custom Home" className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Timeline</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="12 months" className="pl-10" />
                </div>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <Button 
                variant="construction" 
                onClick={handleStartResearch}
                disabled={isResearching}
                className="flex items-center space-x-2"
              >
                {isResearching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Researching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Start AI Research</span>
                  </>
                )}
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Research Results */}
        <Tabs defaultValue="lenders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lenders" className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Lenders</span>
            </TabsTrigger>
            <TabsTrigger value="vendors" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Vendors</span>
            </TabsTrigger>
            <TabsTrigger value="regulations" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Regulations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lenders" className="space-y-4">
            {lenderResults.map((lender, index) => (
              <Card key={index} className="shadow-card hover:shadow-construction transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{lender.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-warning fill-current" />
                          <span className="text-sm text-muted-foreground ml-1">{lender.rating}</span>
                        </div>
                        <Badge variant="secondary">Processing: {lender.processingTime}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{lender.rate}</div>
                      <div className="text-sm text-muted-foreground">Interest Rate</div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Max Loan Amount</div>
                      <div className="font-semibold text-foreground">{lender.maxLoan}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Specialties</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lender.specialties.map((specialty) => (
                          <Badge key={specialty} variant="outline" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Mail className="w-4 h-4 mr-1" />
                        Email
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4">
            {vendorResults.map((vendor, index) => (
              <Card key={index} className="shadow-card hover:shadow-construction transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{vendor.name}</h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <Badge variant="secondary">{vendor.category}</Badge>
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-warning fill-current" />
                          <span className="text-sm text-muted-foreground ml-1">{vendor.rating}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-1" />
                          {vendor.distance}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{vendor.price}</div>
                      <div className="text-sm text-muted-foreground">Estimated Cost</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {vendor.specialties.map((specialty) => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                    <Button size="sm" variant="construction">
                      <Phone className="w-4 h-4 mr-1" />
                      Contact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="regulations" className="space-y-4">
            {regulationResults.map((regulation, index) => (
              <Card key={index} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{regulation.title}</h3>
                      <div className="text-sm text-muted-foreground mt-1">{regulation.authority}</div>
                    </div>
                    <Badge 
                      variant={
                        regulation.status === "Required" ? "destructive" :
                        regulation.status === "Verified" ? "default" : "secondary"
                      }
                    >
                      {regulation.status}
                    </Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Timeline</div>
                      <div className="font-semibold text-foreground">{regulation.timeline}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Est. Cost</div>
                      <div className="font-semibold text-foreground">{regulation.cost}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Requirements</div>
                      <div className="text-sm text-foreground">
                        {regulation.requirements.length} items
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Requirements:</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {regulation.requirements.map((req, reqIndex) => (
                        <li key={reqIndex} className="flex items-center">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

export default AIResearchDashboard;