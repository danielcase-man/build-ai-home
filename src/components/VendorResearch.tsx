import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Star, 
  DollarSign, 
  Loader2,
  Building2,
  Users,
  CheckCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VendorCategory {
  id: string;
  name: string;
  description: string;
  phase: string;
  category: string;
  subcategory: string;
  typical_cost: string;
}

interface Vendor {
  id: string;
  project_id: string;
  category_id: string;
  business_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  rating: number;
  review_count: number;
  cost_estimate_low: number;
  cost_estimate_avg: number;
  cost_estimate_high: number;
  notes: string;
  status: string;
  ai_generated: boolean;
}

interface VendorResearchProps {
  projectId: string;
  zipCode: string;
  location: string;
}

export const VendorResearch = ({ projectId, zipCode, location }: VendorResearchProps) => {
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const phases = [
    { value: 'all', label: 'All Phases' },
    { value: 'pre_construction', label: 'Pre-Construction' },
    { value: 'site_preparation', label: 'Site Preparation' },
    { value: 'foundation_and_structure', label: 'Foundation & Structure' },
    { value: 'exterior_envelope', label: 'Exterior Shell' },
    { value: 'mechanical_systems', label: 'Mechanical Systems' },
    { value: 'interior_finishes', label: 'Interior Finishes' },
    { value: 'utilities_and_infrastructure', label: 'Utilities' },
    { value: 'landscaping_and_exterior', label: 'Landscaping' },
    { value: 'project_management_and_oversight', label: 'Project Management' },
    { value: 'financial_and_insurance_services', label: 'Financial Services' },
    { value: 'specialty_services', label: 'Specialty Services' }
  ];

  useEffect(() => {
    fetchVendorCategories();
    fetchExistingVendors();
  }, [projectId]);

  const fetchVendorCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_categories')
        .select('*')
        .order('phase, category, name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load vendor categories');
    }
  };

  const fetchExistingVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('project_id', projectId)
        .order('business_name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
    }
  };

  const runVendorResearch = async () => {
    if (!zipCode) {
      toast.error('ZIP code is required for vendor research');
      return;
    }

    setLoading(true);
    setSearchProgress(0);

    try {
      const filteredCategories = categories.filter(cat => 
        selectedPhase === 'all' || cat.phase === selectedPhase
      );

      for (let i = 0; i < filteredCategories.length; i++) {
        const category = filteredCategories[i];
        setSearchProgress(((i + 1) / filteredCategories.length) * 100);
        
        // Use AI-powered vendor research via Perplexity
        const { data, error } = await supabase.functions.invoke('ai-vendor-research', {
          body: {
            projectId,
            location,
            zipCode,
            categoryId: category.id,
            categoryName: category.name,
            phase: category.phase
          }
        });
        
        if (error) {
          console.error('Error in AI vendor research:', error);
          toast.error(`Failed to research vendors for ${category.name}`);
        } else if (data?.success) {
          toast.success(`Found ${data.count} vendors for ${category.name}`);
        } else {
          toast.error(`AI research failed for ${category.name}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Refresh vendor list
      await fetchExistingVendors();
      toast.success('AI vendor research completed!');

    } catch (error: any) {
      console.error('Error during vendor research:', error);
      toast.error('Failed to complete vendor research');
    } finally {
      setLoading(false);
      setSearchProgress(0);
    }
  };

  const generateMockVendors = (category: VendorCategory, zipCode: string, location: string) => {
    // Generate 2-4 mock vendors per category
    const vendorCount = Math.floor(Math.random() * 3) + 2;
    const vendors = [];

    for (let i = 0; i < vendorCount; i++) {
      const businessNames = [
        `${location} ${category.name}`,
        `Premium ${category.name} Co.`,
        `Quality ${category.name} Services`,
        `Local ${category.name} Experts`
      ];

      vendors.push({
        business_name: businessNames[i] || `${category.name} Pro ${i + 1}`,
        contact_name: `Contact Person ${i + 1}`,
        phone: `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        email: `contact${i + 1}@${category.name.toLowerCase().replace(/\s+/g, '')}.com`,
        website: `www.${category.name.toLowerCase().replace(/\s+/g, '')}${i + 1}.com`,
        address: `${Math.floor(Math.random() * 9999) + 1} Main St`,
        city: location.split(',')[0] || 'City',
        state: location.split(',')[1]?.trim() || 'State',
        zip_code: zipCode,
        rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0 - 5.0 rating
        review_count: Math.floor(Math.random() * 200) + 10,
        cost_estimate_low: Math.floor(Math.random() * 5000) + 1000,
        cost_estimate_avg: Math.floor(Math.random() * 8000) + 3000,
        cost_estimate_high: Math.floor(Math.random() * 12000) + 6000,
        notes: `Specialized in ${category.description.toLowerCase()}`,
        status: 'researched',
        ai_generated: true
      });
    }

    return vendors;
  };

  const filteredCategories = categories.filter(category => 
    selectedPhase === 'all' || category.phase === selectedPhase
  );

  const filteredVendors = vendors.filter(vendor =>
    searchQuery === '' || 
    vendor.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getVendorsByCategory = (categoryId: string) => {
    return vendors.filter(vendor => vendor.category_id === categoryId);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            AI Vendor Research
          </CardTitle>
          <CardDescription>
            Use AI to research and populate your local vendor database for {location} ({zipCode})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={runVendorResearch}
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching Vendors...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Start AI Vendor Research
                </>
              )}
            </Button>
            <div className="text-sm text-muted-foreground">
              {vendors.length} vendors found
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <Progress value={searchProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                Researching local vendors and suppliers... {Math.round(searchProgress)}% complete
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={selectedPhase} onValueChange={setSelectedPhase}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-6 gap-1">
          {phases.slice(0, 6).map(phase => (
            <TabsTrigger key={phase.value} value={phase.value} className="text-xs">
              {phase.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md mb-4"
          />
        </div>

        <TabsContent value={selectedPhase} className="space-y-4">
          {selectedPhase === 'all' ? (
            <div className="space-y-6">
              {phases.slice(1).map(phase => {
                const phaseCategories = categories.filter(cat => cat.phase === phase.value);
                if (phaseCategories.length === 0) return null;

                return (
                  <Card key={phase.value}>
                    <CardHeader>
                      <CardTitle className="text-lg">{phase.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {phaseCategories.map(category => {
                          const categoryVendors = getVendorsByCategory(category.id);
                          return (
                            <Card key={category.id} className="border border-border/50">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm">{category.name}</CardTitle>
                                  <Badge variant={categoryVendors.length > 0 ? "default" : "secondary"}>
                                    {categoryVendors.length}
                                  </Badge>
                                </div>
                                <CardDescription className="text-xs">
                                  {category.description}
                                </CardDescription>
                              </CardHeader>
                              {categoryVendors.length > 0 && (
                                <CardContent className="pt-0">
                                  <div className="space-y-2">
                                    {categoryVendors.slice(0, 2).map(vendor => (
                                      <div key={vendor.id} className="text-xs border-l-2 border-primary/20 pl-2">
                                        <div className="font-medium">{vendor.business_name}</div>
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                          {vendor.rating} ({vendor.review_count})
                                        </div>
                                      </div>
                                    ))}
                                    {categoryVendors.length > 2 && (
                                      <div className="text-xs text-muted-foreground">
                                        +{categoryVendors.length - 2} more...
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map(category => {
                const categoryVendors = getVendorsByCategory(category.id);
                return (
                  <Card key={category.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <Badge variant={categoryVendors.length > 0 ? "default" : "secondary"}>
                          {categoryVendors.length} vendors
                        </Badge>
                      </div>
                      <CardDescription>
                        {category.description}
                      </CardDescription>
                      <div className="text-sm text-muted-foreground">
                        Typical cost: {category.typical_cost}
                      </div>
                    </CardHeader>
                    {categoryVendors.length > 0 && (
                      <CardContent>
                        <div className="space-y-3">
                          {categoryVendors.map(vendor => (
                            <div key={vendor.id} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{vendor.business_name}</h4>
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                  <span className="text-sm">{vendor.rating}</span>
                                </div>
                              </div>
                              
                              <div className="space-y-1 text-sm text-muted-foreground">
                                {vendor.contact_name && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3" />
                                    {vendor.contact_name}
                                  </div>
                                )}
                                {vendor.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    {vendor.phone}
                                  </div>
                                )}
                                {vendor.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3" />
                                    {vendor.email}
                                  </div>
                                )}
                                {vendor.website && (
                                  <div className="flex items-center gap-2">
                                    <Globe className="h-3 w-3" />
                                    {vendor.website}
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  {vendor.address}, {vendor.city}, {vendor.state} {vendor.zip_code}
                                </div>
                              </div>

                              {vendor.cost_estimate_avg && (
                                <div className="flex items-center gap-2 text-sm">
                                  <DollarSign className="h-3 w-3" />
                                  <span>
                                    ${vendor.cost_estimate_low?.toLocaleString()} - ${vendor.cost_estimate_high?.toLocaleString()}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    Avg: ${vendor.cost_estimate_avg?.toLocaleString()}
                                  </Badge>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2">
                                <Badge variant="outline">
                                  {vendor.review_count} reviews
                                </Badge>
                                <Badge variant={vendor.status === 'selected' ? 'default' : 'secondary'}>
                                  {vendor.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};