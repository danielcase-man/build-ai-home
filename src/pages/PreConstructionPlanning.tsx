import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, FileText, ClipboardCheck, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VendorResearch } from '@/components/VendorResearch';
import { supabase } from '@/integrations/supabase/client';

const preConstructionCategories = {
  professional_services: {
    icon: Users,
    title: "Professional Services",
    description: "Expert consultants and design professionals",
    subcategories: {
      architects: {
        description: "Design home structure, style, and create blueprints",
        typical_cost: "$125-$250 per hour",
        items: [
          "Residential architects",
          "Custom home architects", 
          "Green building architects"
        ]
      },
      engineers: {
        description: "Structural, civil, and MEP engineering",
        typical_cost: "$100-$200 per hour",
        items: [
          "Structural engineers",
          "Civil engineers",
          "Geotechnical engineers", 
          "Mechanical engineers",
          "Electrical engineers"
        ]
      },
      interior_designers: {
        description: "Interior layout and design services",
        typical_cost: "$50-$200 per hour",
        items: [
          "Kitchen designers",
          "Bathroom designers",
          "Lighting designers"
        ]
      },
      land_surveyors: {
        description: "Site surveying and property boundaries",
        typical_cost: "$500-$2000 per survey",
        items: [
          "Boundary surveyors",
          "Topographic surveyors",
          "ALTA surveyors",
          "Construction surveyors"
        ]
      }
    }
  },
  regulatory_and_legal: {
    icon: FileText,
    title: "Regulatory & Legal",
    description: "Permits, legal services, and compliance",
    subcategories: {
      permit_authorities: {
        description: "Government entities issuing building permits",
        items: [
          "City building departments",
          "County building departments",
          "Municipal authorities",
          "HOA approval boards"
        ]
      },
      legal_services: {
        description: "Construction law and contract services",
        items: [
          "Construction attorneys",
          "Real estate attorneys",
          "Contract specialists",
          "Zoning attorneys"
        ]
      },
      consultants: {
        description: "Specialized consulting services",
        items: [
          "Environmental consultants",
          "Planning consultants",
          "Code consultants",
          "Sustainability consultants"
        ]
      }
    }
  },
  testing_and_inspection: {
    icon: ClipboardCheck,
    title: "Testing & Inspection",
    description: "Site analysis and pre-construction testing",
    subcategories: {
      soil_testing: {
        description: "Geotechnical and soil analysis",
        items: [
          "Geotechnical testing companies",
          "Soil engineers",
          "Environmental testing labs"
        ]
      },
      site_analysis: {
        description: "Pre-construction site evaluation",
        items: [
          "Environmental assessment companies",
          "Hazmat testing",
          "Archaeological surveys"
        ]
      }
    }
  }
};

export default function PreConstructionPlanning() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [researchedCategories, setResearchedCategories] = useState<Set<string>>(new Set());
  const [existingVendors, setExistingVendors] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchProject();
    checkExistingVendors();
  }, [id]);

  const fetchProject = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const handleResearchComplete = (subcategoryKey: string, vendors: any[]) => {
    setResearchedCategories(prev => new Set(prev).add(subcategoryKey));
    setSelectedSubcategory(null);
    // Refresh vendor counts to show the updated count
    checkExistingVendors();
  };

  const checkExistingVendors = async () => {
    if (!id) return;
    
    try {
      const vendorCounts: Record<string, number> = {};
      
      // Check vendor count for each subcategory by mapping to actual database category names
      const subcategoryMappings = [
        { subKey: 'architects', categoryName: 'architects' },
        { subKey: 'engineers', categoryName: 'engineers' },
        { subKey: 'interior_designers', categoryName: 'interior_designers' },
        { subKey: 'land_surveyors', categoryName: 'land_surveyors' },
        { subKey: 'permit_authorities', categoryName: 'permit authorities' },
        { subKey: 'legal_services', categoryName: 'legal_services' },
        { subKey: 'consultants', categoryName: 'consultants' },
        { subKey: 'soil_testing', categoryName: 'soil_testing' },
        { subKey: 'site_analysis', categoryName: 'site_analysis' }
      ];

      for (const mapping of subcategoryMappings) {
        // First get the category ID
        const { data: category, error: categoryError } = await supabase
          .from('vendor_categories')
          .select('id')
          .eq('name', mapping.categoryName)
          .eq('phase', 'Pre-Construction Planning & Design')
          .maybeSingle();

        if (!categoryError && category) {
          // Then count vendors for this category
          const { count, error: vendorError } = await supabase
            .from('vendors')
            .select('*', { count: 'exact' })
            .eq('project_id', id)
            .eq('category_id', category.id);

          if (!vendorError && count !== null) {
            vendorCounts[mapping.subKey] = count;
          }
        }
      }

      setExistingVendors(vendorCounts);
      console.log('Vendor counts:', vendorCounts);
    } catch (error) {
      console.error('Error checking existing vendors:', error);
    }
  };

  const getVendorResultsUrl = (subcategoryKey: string, subcategoryName: string) => {
    // Create a mock category ID based on the subcategory for the URL
    const categoryParam = encodeURIComponent(subcategoryKey);
    const subcategoryParam = encodeURIComponent(subcategoryName);
    return `/project/${id}/vendors?category=${categoryParam}&subcategory=${subcategoryParam}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/project/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Pre-Construction Planning & Design
          </h1>
          <p className="text-muted-foreground text-lg">
            Essential services and professionals needed before construction begins
          </p>
        </div>

        <div className="grid gap-8">
          {Object.entries(preConstructionCategories).map(([categoryKey, category]) => {
            const Icon = category.icon;
            return (
              <Card key={categoryKey} className="border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{category.title}</CardTitle>
                      <CardDescription className="text-base">
                        {category.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {Object.entries(category.subcategories).map(([subKey, subcategory]) => (
                      <div key={subKey} className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-foreground capitalize mb-1">
                            {subKey.replace(/_/g, ' ')}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            {subcategory.description}
                          </p>
                          {'typical_cost' in subcategory && (
                            <Badge variant="secondary" className="text-xs">
                              {(subcategory as any).typical_cost}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {subcategory.items.map((item, index) => (
                            <div 
                              key={index}
                              className="text-sm text-muted-foreground hover:text-foreground cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors"
                            >
                              • {item}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-border">
                          {selectedSubcategory === subKey ? (
                            <div className="w-full">
                              <VendorResearch
                                projectId={id!}
                                location={project?.location || 'Your Location'}
                                subcategoryKey={subKey}
                                subcategoryName={subKey.replace(/_/g, ' ')}
                                onResearchComplete={(vendors) => handleResearchComplete(subKey, vendors)}
                              />
                            </div>
                          ) : (
                            <>
                              {existingVendors[subKey] > 0 ? (
                                <div className="flex gap-2 w-full">
                                  <Button 
                                    variant="default" 
                                    size="sm"
                                    asChild
                                    className="flex-1"
                                  >
                                    <Link to={getVendorResultsUrl(subKey, subKey.replace(/_/g, ' '))}>
                                      <Eye className="h-4 w-4 mr-1" />
                                      View {existingVendors[subKey]} Vendors
                                    </Link>
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setSelectedSubcategory(subKey)}
                                  >
                                    Research More
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setSelectedSubcategory(subKey)}
                                    className="flex-1"
                                  >
                                    Research Vendors
                                  </Button>
                                  {researchedCategories.has(subKey) && (
                                    <Button 
                                      variant="default" 
                                      size="sm"
                                      asChild
                                    >
                                      <Link to={getVendorResultsUrl(subKey, subKey.replace(/_/g, ' '))}>
                                        <Eye className="h-4 w-4 mr-1" />
                                        View Results
                                      </Link>
                                    </Button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}