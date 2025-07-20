import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Filter, Users, Building, Star, Phone, Mail, MapPin, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Vendor {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  rating: number | null;
  review_count: number | null;
  cost_estimate_low: number | null;
  cost_estimate_high: number | null;
  notes: string | null;
  status: string;
  ai_generated: boolean;
  category_id: string;
  category_name: string;
  category_phase: string;
}

interface VendorCategory {
  id: string;
  name: string;
  phase: string;
  description: string | null;
}

export const ProjectVendors: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    if (id) {
      fetchVendorsAndCategories();
    }
  }, [id]);

  const fetchVendorsAndCategories = async () => {
    try {
      setLoading(true);

      // Fetch vendors with category information
      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select(`
          *,
          vendor_categories!inner(
            id,
            name,
            phase,
            description
          )
        `)
        .eq('project_id', id);

      if (vendorsError) throw vendorsError;

      // Transform the data to flatten category information
      const transformedVendors: Vendor[] = (vendorsData || []).map(vendor => ({
        ...vendor,
        category_name: vendor.vendor_categories.name,
        category_phase: vendor.vendor_categories.phase
      }));

      setVendors(transformedVendors);

      // Get unique categories from vendors
      const uniqueCategories = vendorsData?.reduce((acc: VendorCategory[], vendor) => {
        const existingCategory = acc.find(cat => cat.id === vendor.vendor_categories.id);
        if (!existingCategory) {
          acc.push({
            id: vendor.vendor_categories.id,
            name: vendor.vendor_categories.name,
            phase: vendor.vendor_categories.phase,
            description: vendor.vendor_categories.description
          });
        }
        return acc;
      }, []) || [];

      setCategories(uniqueCategories);
      setSelectedCategories(uniqueCategories.map(cat => cat.id));

    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: "Error",
        description: "Failed to load vendors. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(vendor.category_id);
    const phaseMatch = selectedPhase === 'all' || vendor.category_phase === selectedPhase;
    const statusMatch = selectedStatus === 'all' || vendor.status === selectedStatus;
    
    return categoryMatch && phaseMatch && statusMatch;
  });

  const groupedVendors = filteredVendors.reduce((acc, vendor) => {
    const categoryName = vendor.category_name;
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(vendor);
    return acc;
  }, {} as Record<string, Vendor[]>);

  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories(prev => [...prev, categoryId]);
    } else {
      setSelectedCategories(prev => prev.filter(id => id !== categoryId));
    }
  };

  const formatCostRange = (vendor: Vendor) => {
    if (vendor.cost_estimate_low && vendor.cost_estimate_high) {
      return `$${vendor.cost_estimate_low.toLocaleString()} - $${vendor.cost_estimate_high.toLocaleString()}`;
    }
    if (vendor.cost_estimate_low) {
      return `From $${vendor.cost_estimate_low.toLocaleString()}`;
    }
    if (vendor.cost_estimate_high) {
      return `Up to $${vendor.cost_estimate_high.toLocaleString()}`;
    }
    return 'Cost not available';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'selected': return 'default';
      case 'contacted': return 'secondary';
      case 'researched': return 'outline';
      default: return 'outline';
    }
  };

  const uniquePhases = [...new Set(categories.map(cat => cat.phase))];
  const uniqueStatuses = [...new Set(vendors.map(vendor => vendor.status))];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">All Project Vendors</h2>
          <p className="text-muted-foreground">
            Manage and filter all vendors across your project
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Phase Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Phase</label>
              <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                <SelectTrigger>
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {uniquePhases.map(phase => (
                    <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Actions</label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedCategories(categories.map(cat => cat.id))}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedCategories([])}
                >
                  Clear All
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Category Filters */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Categories</label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map(category => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={category.id}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={(checked) => handleCategoryToggle(category.id, !!checked)}
                  />
                  <label 
                    htmlFor={category.id} 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {category.name}
                  </label>
                  <Badge variant="outline" className="text-xs">
                    {vendors.filter(v => v.category_id === category.id).length}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendors by Category */}
      <div className="space-y-6">
        {Object.keys(groupedVendors).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
              <p className="text-muted-foreground text-center">
                {vendors.length === 0 
                  ? "No vendors have been added to this project yet."
                  : "No vendors match the current filter criteria."}
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedVendors).map(([categoryName, categoryVendors]) => (
            <Card key={categoryName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    <CardTitle className="text-xl">{categoryName}</CardTitle>
                    <Badge variant="secondary">
                      {categoryVendors.length} vendor{categoryVendors.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {categoryVendors.map(vendor => (
                    <Card key={vendor.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-lg">{vendor.business_name}</h4>
                              <Badge variant={getStatusBadgeVariant(vendor.status)}>
                                {vendor.status}
                              </Badge>
                              {vendor.ai_generated && (
                                <Badge variant="outline" className="text-xs">AI</Badge>
                              )}
                            </div>
                            
                            {vendor.contact_name && (
                              <p className="text-sm text-muted-foreground">
                                Contact: {vendor.contact_name}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              {vendor.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{vendor.phone}</span>
                                </div>
                              )}
                              {vendor.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <span>{vendor.email}</span>
                                </div>
                              )}
                              {(vendor.city || vendor.state) && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{[vendor.city, vendor.state].filter(Boolean).join(', ')}</span>
                                </div>
                              )}
                            </div>

                            {vendor.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm font-medium">{vendor.rating.toFixed(1)}</span>
                                {vendor.review_count && (
                                  <span className="text-sm text-muted-foreground">
                                    ({vendor.review_count} reviews)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <DollarSign className="h-4 w-4" />
                              <span>{formatCostRange(vendor)}</span>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                              <Button variant="outline" size="sm">
                                Contact
                              </Button>
                            </div>
                          </div>
                        </div>

                        {vendor.notes && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-muted-foreground">{vendor.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};