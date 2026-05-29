import { useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Reusable Delete Order dialog that asks for a reason and calls
 * DELETE /api/orders/{id}?reason=...
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open: boolean) => void
 *  - order: { id, order_number } | null
 *  - onDeleted: () => void  -> called after successful delete
 */
const DeleteOrderDialog = ({ open, onOpenChange, order, onDeleted }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (submitting) return;
    setReason('');
    setError('');
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!order) return;
    if (!reason.trim()) {
      setError('A reason is required to delete this order.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(
        `${API}/orders/${order.id}?reason=${encodeURIComponent(reason.trim())}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setReason('');
      onOpenChange(false);
      if (onDeleted) onDeleted(res?.data?.message || 'Order deleted successfully');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(true); }}>
      <DialogContent className="sm:max-w-md" data-testid="delete-order-dialog">
        <DialogHeader>
          <DialogTitle>
            Delete Order {order ? `#${order.order_number}` : ''}
          </DialogTitle>
          <DialogDescription>
            Super Admin: deletes immediately. Others: a delete request is sent for super admin approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="delete-reason">
            Reason for deletion <span className="text-red-500">*</span>
          </Label>
          <textarea
            id="delete-reason"
            data-testid="delete-reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Customer cancelled, duplicate entry, wrong details..."
            rows={4}
            autoFocus
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {error && (
            <p className="text-sm text-red-600" data-testid="delete-error">{error}</p>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={close}
            disabled={submitting}
            data-testid="delete-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting || !reason.trim()}
            data-testid="delete-confirm-button"
          >
            {submitting ? 'Deleting...' : 'Delete Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteOrderDialog;
