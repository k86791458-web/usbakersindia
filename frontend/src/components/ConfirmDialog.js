import React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

/**
 * Confirmation Dialog Component
 * Reusable component for all confirmations
 */
export const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default' // 'default' | 'destructive'
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/**
 * Logout Confirmation Hook
 */
export const useLogoutConfirm = (onConfirm) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const showConfirm = () => setIsOpen(true);
  const hideConfirm = () => setIsOpen(false);

  const handleConfirm = () => {
    hideConfirm();
    onConfirm();
  };

  const LogoutConfirmDialog = () => (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={hideConfirm}
      onConfirm={handleConfirm}
      title="Logout Confirmation"
      description="Are you sure you want to logout? Any unsaved changes will be lost."
      confirmText="Yes, Logout"
      cancelText="Cancel"
      variant="destructive"
    />
  );

  return { showConfirm, LogoutConfirmDialog };
};

/**
 * Delete Order Confirmation Hook
 */
export const useDeleteConfirm = (onConfirm) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [itemData, setItemData] = React.useState(null);

  const showConfirm = (data) => {
    setItemData(data);
    setIsOpen(true);
  };

  const hideConfirm = () => {
    setIsOpen(false);
    setItemData(null);
  };

  const handleConfirm = () => {
    hideConfirm();
    onConfirm(itemData);
  };

  const DeleteConfirmDialog = () => (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={hideConfirm}
      onConfirm={handleConfirm}
      title="Delete Confirmation"
      description={`Are you sure you want to delete this order? This action cannot be undone.`}
      confirmText="Yes, Delete"
      cancelText="Cancel"
      variant="destructive"
    />
  );

  return { showConfirm, DeleteConfirmDialog };
};

/**
 * Duplicate Order Check Hook
 */
export const useDuplicateCheck = (onConfirm) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [duplicateInfo, setDuplicateInfo] = React.useState(null);

  const showConfirm = (info) => {
    setDuplicateInfo(info);
    setIsOpen(true);
  };

  const hideConfirm = () => {
    setIsOpen(false);
    setDuplicateInfo(null);
  };

  const handleConfirm = () => {
    hideConfirm();
    onConfirm();
  };

  const DuplicateCheckDialog = () => (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={hideConfirm}
      onConfirm={handleConfirm}
      title="Possible Duplicate Order"
      description={duplicateInfo?.message || 'A similar order already exists. Do you want to create this order anyway?'}
      confirmText="Yes, Create Order"
      cancelText="Cancel"
    />
  );

  return { showConfirm, DuplicateCheckDialog };
};
