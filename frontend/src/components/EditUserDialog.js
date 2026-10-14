import { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ROLE_OPTIONS = [
  { v: 'super_admin', label: 'Super Admin' },
  { v: 'outlet_admin', label: 'Outlet Admin' },
  { v: 'order_manager', label: 'Order Manager' },
  { v: 'factory_manager', label: 'Factory Manager' },
  { v: 'kitchen', label: 'Kitchen Staff' },
  { v: 'delivery', label: 'Delivery Staff' },
  { v: 'accounts', label: 'Accounts' },
];

const OutletScope = ({ form, setForm, outlets }) => (
  <div className="space-y-2">
    <Label>Outlet Access</Label>
    <div className="flex gap-2 flex-wrap">
      {[['all', 'All Outlets'], ['multiple', 'Multiple Outlets'], ['specific', 'Specific Outlet']].map(([v, label]) => (
        <button type="button" key={v} onClick={() => setForm({ ...form, outlet_scope: v })}
          className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${form.outlet_scope === v ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'}`}
          data-testid={`edit-outlet-scope-${v}`}>{label}</button>
      ))}
    </div>
    {form.outlet_scope === 'specific' && (
      <Select value={form.outlet_id || 'none'} onValueChange={v => setForm({ ...form, outlet_id: v === 'none' ? null : v })}>
        <SelectTrigger data-testid="edit-user-outlet-select"><SelectValue placeholder="Select outlet" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">-- Select --</SelectItem>
          {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>
    )}
    {form.outlet_scope === 'multiple' && (
      <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
        {outlets.map(o => {
          const checked = (form.outlet_ids || []).includes(o.id);
          return (
            <div key={o.id} className="flex items-center gap-2">
              <Checkbox id={`edit-ol-${o.id}`} checked={checked} data-testid={`edit-outlet-checkbox-${o.id}`}
                onCheckedChange={() => setForm({ ...form, outlet_ids: checked ? form.outlet_ids.filter(i => i !== o.id) : [...(form.outlet_ids || []), o.id] })} />
              <label htmlFor={`edit-ol-${o.id}`} className="text-sm">{o.name}</label>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export const EditUserDialog = ({ user, outlets, open, onOpenChange, onSaved }) => {
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name, email: user.email, phone: user.phone, role: user.role,
        incentive_percentage: user.incentive_percentage || 0,
        outlet_scope: user.outlet_scope || 'specific', outlet_id: user.outlet_id || null,
        outlet_ids: user.outlet_ids || [], reset_permissions_to_role: false,
      });
      setError('');
    }
  }, [user]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await axios.put(`${API}/users/${user.id}`, { ...form, incentive_percentage: Number(form.incentive_percentage) || 0 });
      onSaved(`${form.name} updated successfully`);
      onOpenChange(false);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  const field = (k, label, type = 'text') => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={form[k] ?? ''} onChange={e => setForm({ ...form, [k]: e.target.value })} data-testid={`edit-user-${k}-input`} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="edit-user-dialog">
        <DialogHeader>
          <DialogTitle>Edit User: {user.name}</DialogTitle>
          <DialogDescription>Update details, role and outlet access.</DialogDescription>
        </DialogHeader>
        {error && <Alert variant="destructive"><AlertDescription data-testid="edit-user-error">{error}</AlertDescription></Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('name', 'Name')}
          {field('email', 'Email', 'email')}
          {field('phone', 'Phone')}
          {field('incentive_percentage', 'Incentive %', 'number')}
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger data-testid="edit-user-role-select"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <OutletScope form={form} setForm={setForm} outlets={outlets} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!form.reset_permissions_to_role} onCheckedChange={v => setForm({ ...form, reset_permissions_to_role: !!v })} data-testid="edit-user-reset-perms-checkbox" />
          Reset permissions & page access to the role's defaults
        </label>
        <Button onClick={save} disabled={saving} className="w-full text-white" style={{ backgroundColor: '#e92587' }} data-testid="edit-user-save-button">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
