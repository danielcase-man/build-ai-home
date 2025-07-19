import React, { useState } from 'react';
import { Search, MapPin, Loader2, Users, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VendorResearchStaging } from './VendorResearchStaging';

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
  const [specialization, setSpecialization] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressStage, setProgressStage] = useState('');
  const [researchResults, setResearchResults] = useState<any>(null);

  // Define specializations based on subcategory
  const getSpecializationOptions = () => {
    if (subcategoryKey === 'architects') {
      return [
        { value: 'residential', label: 'Residential Architects' },
        { value: 'custom_home', label: 'Custom Home Architects' },
        { value: 'green_building', label: 'Green Building Architects' },
        { value: 'modern_design', label: 'Modern Design Architects' },
        { value: 'traditional', label: 'Traditional Style Architects' },
        { value: 'luxury', label: 'Luxury Home Architects' },
        { value: 'renovation', label: 'Renovation Specialists' }
      ];
    } else if (subcategoryKey === 'engineers') {
      return [
        { value: 'structural', label: 'Structural Engineers' },
        { value: 'civil', label: 'Civil Engineers' },
        { value: 'geotechnical', label: 'Geotechnical Engineers' },
        { value: 'mechanical', label: 'Mechanical Engineers' },
        { value: 'electrical', label: 'Electrical Engineers' }
      ];
    } else if (subcategoryKey === 'interior_designers') {
      return [
        { value: 'kitchen', label: 'Kitchen Designers' },
        { value: 'bathroom', label: 'Bathroom Designers' },
        { value: 'lighting', label: 'Lighting Designers' },
        { value: 'general', label: 'General Interior Designers' }
      ];
    }
    return [];
  };

  const specializationOptions = getSpecializationOptions();

  const handleStartResearch = async () => {
    if (!zipCode.trim()) {
      toast.error('Please enter a zip code');
      return;
    }

    setIsResearching(true);
    setProgress(0);
    setProgressMessage('Preparing research...');
    setProgressStage('initializing');
    
    try {
      // First, find or create a vendor category for this subcategory
      let categoryId: string;
      
      setProgressMessage('Setting up vendor category...');
      setProgress(5);
      
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

      setProgress(10);
      setProgressMessage('Connecting to AI research service...');

      // Get Supabase project info for streaming URL
      const { data: { session } } = await supabase.auth.getSession();
      const baseUrl = `https://kgvckbmwanmngryskari.functions.supabase.co`;
      
      // Call the streaming edge function
      const response = await fetch(`${baseUrl}/ai-vendor-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || 'anonymous'}`,
        },
        body: JSON.stringify({
          projectId,
          location,
          zipCode: zipCode.trim(),
          categoryId,
          categoryName: subcategoryName,
          specialization: specialization || null,
          customContext: customContext.trim() || null,
          phase: 'Pre-Construction Planning & Design',
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (!data) continue;

              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'progress') {
                  setProgress(parsed.progress || 0);
                  setProgressMessage(parsed.message || '');
                  setProgressStage(parsed.stage || '');
                } else if (parsed.type === 'complete') {
                  setProgress(100);
                  setProgressMessage(parsed.message || 'Research complete!');
                  setProgressStage('complete');
                  setResearchResults(parsed);
                  onResearchComplete(parsed.vendors || []);
                  toast.success(`Found ${parsed.count || 0} vendors for ${subcategoryName}`);
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.message || 'Research failed');
                }
              } catch (parseError) {
                console.log('Skipping non-JSON line:', data);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Error researching vendors:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to research vendors. Please try again.';
      toast.error(`Research failed: ${errorMessage}`);
      setProgressMessage('Research failed');
      setProgressStage('error');
    } finally {
      setIsResearching(false);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
        setProgressStage('');
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
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
        <CardContent className="space-y-6">
          {/* Specialization Selection */}
          {specializationOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="specialization" className="text-sm font-medium">
                Specialization Type
              </Label>
              <Select value={specialization} onValueChange={setSpecialization} disabled={isResearching}>
                <SelectTrigger id="specialization">
                  <SelectValue placeholder={`Select ${subcategoryName} type`} />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {specializationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Context */}
          <div className="space-y-2">
            <Label htmlFor="context" className="text-sm font-medium">
              Additional Requirements (Optional)
            </Label>
            <Textarea
              id="context"
              placeholder="e.g., luxury homes, green building, modern design, pool houses, specific certifications, licensed, insured, BBB accredited..."
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              disabled={isResearching}
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Add specific requirements to find vendors with certifications, licenses, insurance, or specializations that match your project needs
            </p>
          </div>

          {/* Zip Code and Research Button */}
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
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progressMessage || `AI is searching for ${subcategoryName} vendors in ${location}...`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress}%
                </span>
              </div>
              {progressStage && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${
                    progressStage === 'complete' ? 'bg-success' : 
                    progressStage === 'error' ? 'bg-destructive' : 
                    'bg-primary animate-pulse'
                  }`} />
                  <span className="capitalize">{progressStage.replace(/[_-]/g, ' ')}</span>
                </div>
              )}
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
      
      <VendorResearchStaging projectId={projectId} />
    </div>
  );
};