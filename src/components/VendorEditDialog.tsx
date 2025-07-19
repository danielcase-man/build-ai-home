import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  status: string;
}

interface VendorEditDialogProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendorUpdated: (updatedVendor: Vendor) => void;
}

export const VendorEditDialog: React.FC<VendorEditDialogProps> = ({
  vendor,
  open,
  onOpenChange,
  onVendorUpdated,
}) => {
  const [formData, setFormData] = useState<Partial<Vendor>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (vendor) {
      setFormData({
        business_name: vendor.business_name || '',
        contact_name: vendor.contact_name || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        address: vendor.address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        zip_code: vendor.zip_code || '',
        website: vendor.website || '',
        rating: vendor.rating || undefined,
        review_count: vendor.review_count || undefined,
        cost_estimate_low: vendor.cost_estimate_low || undefined,
        cost_estimate_high: vendor.cost_estimate_high || undefined,
        cost_estimate_avg: vendor.cost_estimate_avg || undefined,
        notes: vendor.notes || '',
        status: vendor.status || 'researched',
      });
    }
  }, [vendor]);

  const handleInputChange = (field: keyof Vendor, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('vendors')
        .update({
          business_name: formData.business_name,
          contact_name: formData.contact_name || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip_code: formData.zip_code || null,
          website: formData.website || null,
          rating: formData.rating || null,
          review_count: formData.review_count || null,
          cost_estimate_low: formData.cost_estimate_low || null,
          cost_estimate_high: formData.cost_estimate_high || null,
          cost_estimate_avg: formData.cost_estimate_avg || null,
          notes: formData.notes || null,
          status: formData.status,
        })
        .eq('id', vendor.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      onVendorUpdated(data);
      onOpenChange(false);
      toast.success('Vendor updated successfully');
    } catch (error) {
      console.error('Error updating vendor:', error);
      toast.error('Failed to update vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Vendor</DialogTitle>
          <DialogDescription>
            Update vendor information and contact details.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                value={formData.business_name || ''}
                onChange={(e) => handleInputChange('business_name', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name || ''}
                onChange={(e) => handleInputChange('contact_name', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state || ''}
                onChange={(e) => handleInputChange('state', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="zip_code">Zip Code</Label>
              <Input
                id="zip_code"
                value={formData.zip_code || ''}
                onChange={(e) => handleInputChange('zip_code', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website || ''}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <Input
                id="rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.rating || ''}
                onChange={(e) => handleInputChange('rating', parseFloat(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="review_count">Review Count</Label>
              <Input
                id="review_count"
                type="number"
                min="0"
                value={formData.review_count || ''}
                onChange={(e) => handleInputChange('review_count', parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cost_estimate_low">Min Cost Estimate ($)</Label>
              <Input
                id="cost_estimate_low"
                type="number"
                min="0"
                value={formData.cost_estimate_low || ''}
                onChange={(e) => handleInputChange('cost_estimate_low', parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cost_estimate_high">Max Cost Estimate ($)</Label>
              <Input
                id="cost_estimate_high"
                type="number"
                min="0"
                value={formData.cost_estimate_high || ''}
                onChange={(e) => handleInputChange('cost_estimate_high', parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status || 'researched'} 
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="researched">Researched</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this vendor..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};