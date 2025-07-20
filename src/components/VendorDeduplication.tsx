import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DeduplicationProps {
  projectId: string;
}

interface DuplicateInfo {
  id: string;
  business_name: string;
  reason: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

interface DeduplicationResult {
  success: boolean;
  dryRun: boolean;
  duplicatesFound: number;
  buildersFound: number;
  totalToRemove: number;
  totalRemoved?: number;
  duplicates: DuplicateInfo[];
  builders: DuplicateInfo[];
  message: string;
}

export const VendorDeduplication: React.FC<DeduplicationProps> = ({ projectId }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DeduplicationResult | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  React.useEffect(() => {
    fetchCategories();
  }, [projectId]);

  const fetchCategories = async () => {
    try {
      const { data: vendors } = await supabase
        .from('vendors')
        .select(`
          category_id,
          vendor_categories!inner(id, name, phase)
        `)
        .eq('project_id', projectId);

      if (vendors) {
        const uniqueCategories = vendors.reduce((acc: any[], vendor) => {
          const categoryId = vendor.vendor_categories.id;
          if (!acc.find(cat => cat.id === categoryId)) {
            acc.push({
              id: categoryId,
              name: vendor.vendor_categories.name,
              phase: vendor.vendor_categories.phase,
              count: vendors.filter(v => v.vendor_categories.id === categoryId).length
            });
          }
          return acc;
        }, []);

        setCategories(uniqueCategories);
        setSelectedCategories(uniqueCategories.map(cat => cat.id));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const runDeduplication = async (dryRun: boolean = true) => {
    setIsRunning(true);
    setResult(null);

    try {
      const results: DeduplicationResult[] = [];

      for (const categoryId of selectedCategories) {
        const { data, error } = await supabase.functions.invoke('deduplicate-vendors', {
          body: {
            projectId,
            categoryId,
            dryRun
          }
        });

        if (error) {
          throw error;
        }

        if (data) {
          results.push(data);
        }
      }

      // Combine results
      const combinedResult: DeduplicationResult = {
        success: true,
        dryRun,
        duplicatesFound: results.reduce((sum, r) => sum + r.duplicatesFound, 0),
        buildersFound: results.reduce((sum, r) => sum + r.buildersFound, 0),
        totalToRemove: results.reduce((sum, r) => sum + r.totalToRemove, 0),
        totalRemoved: results.reduce((sum, r) => sum + (r.totalRemoved || 0), 0),
        duplicates: results.flatMap(r => r.duplicates || []),
        builders: results.flatMap(r => r.builders || []),
        message: dryRun 
          ? `Found ${results.reduce((sum, r) => sum + r.totalToRemove, 0)} vendors to remove across ${selectedCategories.length} categories`
          : `Successfully removed ${results.reduce((sum, r) => sum + (r.totalRemoved || 0), 0)} vendors`
      };

      setResult(combinedResult);

      toast({
        title: dryRun ? "Analysis Complete" : "Deduplication Complete",
        description: combinedResult.message,
        variant: combinedResult.totalToRemove > 0 || (combinedResult.totalRemoved && combinedResult.totalRemoved > 0) ? "default" : "default"
      });

      // Refresh categories after actual deduplication
      if (!dryRun) {
        fetchCategories();
      }

    } catch (error) {
      console.error('Error running deduplication:', error);
      toast({
        title: "Error",
        description: "Failed to run deduplication. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCategoryToggle = (categoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories(prev => [...prev, categoryId]);
    } else {
      setSelectedCategories(prev => prev.filter(id => id !== categoryId));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <CardTitle>Vendor Deduplication</CardTitle>
          </div>
          <CardDescription>
            Remove duplicate vendors and clean up builders from architect categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Categories to Clean</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    {category.count} vendors
                  </Badge>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 pt-2">
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

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={() => runDeduplication(true)}
              disabled={isRunning || selectedCategories.length === 0}
              variant="outline"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Preview Changes
                </>
              )}
            </Button>

            {result && result.totalToRemove > 0 && (
              <Button 
                onClick={() => runDeduplication(false)}
                disabled={isRunning}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove {result.totalToRemove} Vendors
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {result.dryRun ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <CardTitle>
                {result.dryRun ? 'Preview Results' : 'Deduplication Results'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                {result.message}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  Duplicate Vendors 
                  <Badge variant="secondary">{result.duplicatesFound}</Badge>
                </h4>
                {result.duplicates.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.duplicates.map((duplicate, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-sm">
                        <div className="font-medium">{duplicate.business_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Reason: {duplicate.reason}
                        </div>
                        {duplicate.phone && (
                          <div className="text-xs text-muted-foreground">
                            Phone: {duplicate.phone}
                          </div>
                        )}
                        {duplicate.email && (
                          <div className="text-xs text-muted-foreground">
                            Email: {duplicate.email}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No duplicates found</p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  Builders in Architect Category 
                  <Badge variant="secondary">{result.buildersFound}</Badge>
                </h4>
                {result.builders.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.builders.map((builder, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-sm">
                        <div className="font-medium">{builder.business_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Reason: {builder.reason}
                        </div>
                        {builder.notes && (
                          <div className="text-xs text-muted-foreground">
                            Notes: {builder.notes.substring(0, 100)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No builders found in architect categories</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};