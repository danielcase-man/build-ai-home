import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Phone, Mail, MapPin, DollarSign, Plus, Check, Edit, Trash2, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VendorEditDialog } from '@/components/VendorEditDialog';
import { VendorDeleteDialog } from '@/components/VendorDeleteDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  business_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  cost_estimate_low?: number;
  cost_estimate_high?: number;
  cost_estimate_avg?: number;
  notes?: string;
  ai_generated: boolean;
  status: string;
}

export default function VendorResults() {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const subcategory = searchParams.get('subcategory');
  const category = searchParams.get('category');
  
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingVendors, setAddingVendors] = useState<Set<string>>(new Set());
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    fetchVendors();
  }, [projectId, category]);

  const fetchVendors = async () => {
    if (!projectId) return;
    
    try {
      // First find the category ID based on the category name
      const { data: categoryData, error: categoryError } = await supabase
        .from('vendor_categories')
        .select('id')
        .eq('name', category)
        .eq('phase', 'Pre-Construction Planning & Design')
        .maybeSingle();

      if (categoryError && categoryError.code !== 'PGRST116') {
        throw categoryError;
      }

      if (!categoryData) {
        setVendors([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('project_id', projectId)
        .eq('category_id', categoryData.id)
        .order('rating', { ascending: false, nullsFirst: false });

      if (error) {
        throw error;
      }

      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const addVendorToProject = async (vendor: Vendor) => {
    setAddingVendors(prev => new Set(prev).add(vendor.id));
    
    try {
      // Update vendor status to indicate they've been selected
      const { error } = await supabase
        .from('vendors')
        .update({ status: 'selected' })
        .eq('id', vendor.id);

      if (error) {
        throw error;
      }

      // Update local state
      setVendors(prev => 
        prev.map(v => 
          v.id === vendor.id 
            ? { ...v, status: 'selected' }
            : v
        )
      );

      toast.success(`${vendor.business_name} added to your project!`);
    } catch (error) {
      console.error('Error adding vendor to project:', error);
      toast.error('Failed to add vendor to project');
    } finally {
      setAddingVendors(prev => {
        const newSet = new Set(prev);
        newSet.delete(vendor.id);
        return newSet;
      });
    }
  };

  const handleVendorUpdated = (updatedVendor: Vendor) => {
    setVendors(prev => 
      prev.map(v => v.id === updatedVendor.id ? updatedVendor : v)
    );
  };

  const handleVendorDeleted = (vendorId: string) => {
    setVendors(prev => prev.filter(v => v.id !== vendorId));
  };

  const formatCostRange = (vendor: Vendor) => {
    if (vendor.cost_estimate_low && vendor.cost_estimate_high) {
      return `$${vendor.cost_estimate_low.toLocaleString()} - $${vendor.cost_estimate_high.toLocaleString()}`;
    }
    if (vendor.cost_estimate_avg) {
      return `~$${vendor.cost_estimate_avg.toLocaleString()}`;
    }
    return 'Contact for quote';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/project/${projectId}/pre-construction`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pre-Construction
            </Link>
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {subcategory} Vendors
          </h1>
          <p className="text-muted-foreground text-lg">
            {vendors.length} qualified vendors found in your area
          </p>
        </div>

        {vendors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                No vendors found for this category. Try researching again with a different zip code.
              </div>
              <Button variant="outline" asChild>
                <Link to={`/project/${projectId}/pre-construction`}>
                  Back to Research
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {vendors.map((vendor) => (
              <Card key={vendor.id} className="border-border">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{vendor.business_name}</CardTitle>
                      {vendor.contact_name && (
                        <CardDescription>Contact: {vendor.contact_name}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {vendor.ai_generated && (
                        <Badge variant="secondary">AI Research</Badge>
                      )}
                      {vendor.status === 'selected' && (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          <Check className="h-3 w-3 mr-1" />
                          Added
                        </Badge>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingVendor(vendor)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeletingVendor(vendor)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Vendor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      {(vendor.address || vendor.city) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="text-sm">
                            {vendor.address && <div>{vendor.address}</div>}
                            {vendor.city && (
                              <div>{vendor.city}{vendor.state && `, ${vendor.state}`} {vendor.zip_code}</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {vendor.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${vendor.phone}`} className="text-sm hover:text-primary">
                            {vendor.phone}
                          </a>
                        </div>
                      )}
                      
                      {vendor.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${vendor.email}`} className="text-sm hover:text-primary">
                            {vendor.email}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {vendor.rating && (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{vendor.rating}</span>
                          {vendor.review_count && (
                            <span className="text-sm text-muted-foreground">
                              ({vendor.review_count} reviews)
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatCostRange(vendor)}</span>
                      </div>
                      
                      {vendor.website && (
                        <div>
                          <a 
                            href={vendor.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            Visit Website →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {vendor.notes && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground">{vendor.notes}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    {vendor.status === 'selected' ? (
                      <Button disabled className="w-full md:w-auto">
                        <Check className="h-4 w-4 mr-2" />
                        Added to Project
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => addVendorToProject(vendor)}
                        disabled={addingVendors.has(vendor.id)}
                        className="w-full md:w-auto"
                      >
                        {addingVendors.has(vendor.id) ? (
                          'Adding...'
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Add to Project
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Edit Dialog */}
        <VendorEditDialog
          vendor={editingVendor}
          open={!!editingVendor}
          onOpenChange={(open) => !open && setEditingVendor(null)}
          onVendorUpdated={handleVendorUpdated}
        />
        
        {/* Delete Dialog */}
        <VendorDeleteDialog
          vendor={deletingVendor}
          open={!!deletingVendor}
          onOpenChange={(open) => !open && setDeletingVendor(null)}
          onVendorDeleted={handleVendorDeleted}
        />
      </div>
    </div>
  );
}