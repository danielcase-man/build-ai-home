import React, { useState } from 'react';
import { Search, MapPin, Loader2, Users, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VendorResearchProps {
  projectId: string;
  location: string;
  subcategoryKey: string;
  subcategoryName: string;
  onResearchComplete: (vendors: any[]) => void;
}

export const VendorResearch: React.FC<VendorResearchProps> = ({
  projectId,
  location,
  subcategoryKey,
  subcategoryName,
  onResearchComplete
}) => {
  const [zipCode, setZipCode] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [researchResults, setResearchResults] = useState<any>(null);

  const handleStartResearch = async () => {
    if (!zipCode.trim()) {
      toast.error('Please enter a zip code');
      return;
    }

    setIsResearching(true);
    setProgress(10);
    
    try {
      // First, find or create a vendor category for this subcategory
      let categoryId: string;
      
      // Check if category exists
      const { data: existingCategory } = await supabase
        .from('vendor_categories')
        .select('id')
        .eq('name', subcategoryName)
        .eq('phase', 'Pre-Construction Planning & Design')
        .single();

      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        // Create new category
        const { data: newCategory, error: categoryError } = await supabase
          .from('vendor_categories')
          .insert({
            name: subcategoryName,
            category: subcategoryKey,
            phase: 'Pre-Construction Planning & Design',
            description: `Professional ${subcategoryName} services for construction projects`
          })
          .select('id')
          .single();

        if (categoryError) {
          throw categoryError;
        }
        categoryId = newCategory.id;
      }

      setProgress(30);

      // Call the AI vendor research edge function
      const { data, error } = await supabase.functions.invoke('ai-vendor-research', {
        body: {
          projectId,
          location,
          zipCode: zipCode.trim(),
          categoryId,
          categoryName: subcategoryName,
          phase: 'Pre-Construction Planning & Design'
        }
      });

      setProgress(80);

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to research vendors');
      }

      setProgress(100);
      setResearchResults(data);
      onResearchComplete(data.vendors);
      
      toast.success(`Found ${data.count} vendors for ${subcategoryName}`);

    } catch (error) {
      console.error('Error researching vendors:', error);
      toast.error('Failed to research vendors. Please try again.');
    } finally {
      setIsResearching(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          Research {subcategoryName}
        </CardTitle>
        <CardDescription>
          Find qualified local vendors in your area
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Enter zip code (e.g., 90210)"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              disabled={isResearching}
              maxLength={5}
              pattern="[0-9]{5}"
            />
          </div>
          <Button 
            onClick={handleStartResearch}
            disabled={isResearching || !zipCode.trim()}
            className="min-w-[100px]"
          >
            {isResearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Research
              </>
            )}
          </Button>
        </div>

        {isResearching && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              AI is searching for {subcategoryName} vendors in {location}...
            </p>
          </div>
        )}

        {researchResults && (
          <div className="mt-4 p-4 bg-success/10 border border-success/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <span className="font-medium text-success">Research Complete!</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Found {researchResults.count} qualified vendors for {subcategoryName}. 
              Click "View Results" to see details and add vendors to your project.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>Searching in {location} and surrounding areas</span>
        </div>
      </CardContent>
    </Card>
  );
};