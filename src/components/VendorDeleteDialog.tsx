import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  business_name: string;
}

interface VendorDeleteDialogProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendorDeleted: (vendorId: string) => void;
}

export const VendorDeleteDialog: React.FC<VendorDeleteDialogProps> = ({
  vendor,
  open,
  onOpenChange,
  onVendorDeleted,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!vendor) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendor.id);

      if (error) {
        throw error;
      }

      onVendorDeleted(vendor.id);
      onOpenChange(false);
      toast.success(`${vendor.business_name} removed from your project`);
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast.error('Failed to delete vendor');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!vendor) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{vendor.business_name}</strong> from your project? 
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Vendor'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};