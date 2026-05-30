import { useEffect, useState } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings as SettingsIcon, Plus, Trash2, Save, Loader2, Clock, AlertTriangle, ShieldCheck, ShieldOff, KeyRound, Copy, Download, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Settings = () => {
  const { isSuperAdmin } = useAuth();

  // 2FA State (Super Admin only)
  const [twoFactorStatus, setTwoFactorStatus] = useState({ is_two_factor_enabled: false, remaining_backup_codes: 0, is_super_admin: false });
  const [twoFactorSetup, setTwoFactorSetup] = useState(null); // { secret, qr_code, provisioning_uri }
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]); // shown once
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenCode, setRegenCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  // System Settings
  const [systemSettings, setSystemSettings] = useState({
    minimum_payment_percentage: 20,
    birthday_mandatory: false,
    max_orders_per_time_slot: 0
  });

  // Branch Thresholds
  const [outlets, setOutlets] = useState([]);
  const [branchThresholds, setBranchThresholds] = useState({});
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [outletThreshold, setOutletThreshold] = useState(20);

  // Flavours
  const [flavours, setFlavours] = useState([]);
  const [newFlavour, setNewFlavour] = useState('');

  // Occasions
  const [occasions, setOccasions] = useState([]);
  const [newOccasion, setNewOccasion] = useState('');

  // Time Slots
  const [timeSlots, setTimeSlots] = useState([]);
  const [slotStartHour, setSlotStartHour] = useState('10');
  const [slotStartMinute, setSlotStartMinute] = useState('00');
  const [slotStartPeriod, setSlotStartPeriod] = useState('AM');
  const [slotEndHour, setSlotEndHour] = useState('12');
  const [slotEndMinute, setSlotEndMinute] = useState('00');
  const [slotEndPeriod, setSlotEndPeriod] = useState('PM');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const fetchAllSettings = async () => {
    const token = localStorage.getItem('token');
    try {
      // Fetch system settings
      const sysRes = await axios.get(`${API}/system-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemSettings(sysRes.data);

      // Fetch outlets
      const outletsRes = await axios.get(`${API}/outlets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOutlets(outletsRes.data);

      // Fetch flavours
      const flavoursRes = await axios.get(`${API}/flavours`);
      setFlavours(flavoursRes.data);

      // Fetch occasions
      const occasionsRes = await axios.get(`${API}/occasions`);
      setOccasions(occasionsRes.data);

      // Fetch time slots
      const slotsRes = await axios.get(`${API}/time-slots`);
      setTimeSlots(slotsRes.data);

      // Fetch 2FA status (Super Admin only)
      if (isSuperAdmin) {
        try {
          const twoFaRes = await axios.get(`${API}/auth/2fa/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setTwoFactorStatus(twoFaRes.data);
        } catch (e) {
          // ignore — non-blocking
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setError('Failed to load settings');
    }
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 3000);
  };

  // ==================== SYSTEM SETTINGS ====================
  const updateSystemSettings = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      await axios.patch(`${API}/system-settings`, systemSettings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('System settings updated successfully');
    } catch (error) {
      showError('Failed to update system settings');
    } finally {
      setLoading(false);
    }
  };

  // ==================== BRANCH THRESHOLDS ====================
  const setBranchThreshold = async () => {
    if (!selectedOutlet) {
      showError('Please select an outlet');
      return;
    }

    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      await axios.post(`${API}/branch-payment-threshold`, {
        outlet_id: selectedOutlet,
        minimum_payment_percentage: outletThreshold
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess('Branch threshold updated successfully');
      setBranchThresholds({
        ...branchThresholds,
        [selectedOutlet]: outletThreshold
      });
    } catch (error) {
      showError('Failed to update branch threshold');
    } finally {
      setLoading(false);
    }
  };

  // ==================== FLAVOURS ====================
  const addFlavour = async () => {
    if (!newFlavour.trim()) {
      showError('Please enter flavour name');
      return;
    }

    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      await axios.post(`${API}/flavours`, {
        name: newFlavour
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewFlavour('');
      fetchAllSettings();
      showSuccess('Flavour added successfully');
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to add flavour');
    } finally {
      setLoading(false);
    }
  };

  const deleteFlavour = async (flavourId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/flavours/${flavourId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAllSettings();
      showSuccess('Flavour deleted successfully');
    } catch (error) {
      showError('Failed to delete flavour');
    }
  };

  // ==================== OCCASIONS ====================
  const addOccasion = async () => {
    if (!newOccasion.trim()) {
      showError('Please enter occasion name');
      return;
    }

    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      await axios.post(`${API}/occasions`, {
        name: newOccasion
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewOccasion('');
      fetchAllSettings();
      showSuccess('Occasion added successfully');
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to add occasion');
    } finally {
      setLoading(false);
    }
  };

  const deleteOccasion = async (occasionId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/occasions/${occasionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAllSettings();
      showSuccess('Occasion deleted successfully');
    } catch (error) {
      showError('Failed to delete occasion');
    }
  };

  // ==================== TIME SLOTS ====================
  const addTimeSlot = async () => {
    const formattedSlot = `${slotStartHour}:${slotStartMinute} ${slotStartPeriod} - ${slotEndHour}:${slotEndMinute} ${slotEndPeriod}`;

    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      await axios.post(`${API}/time-slots`, {
        time_slot: formattedSlot
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAllSettings();
      showSuccess('Time slot added successfully');
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to add time slot');
    } finally {
      setLoading(false);
    }
  };

  const deleteTimeSlot = async (slotId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API}/time-slots/${slotId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAllSettings();
      showSuccess('Time slot deleted successfully');
    } catch (error) {
      showError('Failed to delete time slot');
    }
  };

  const handleResetSystem = async () => {
    if (resetConfirmText !== 'RESET') return;
    const token = localStorage.getItem('token');
    setResetting(true);
    try {
      const res = await axios.post(`${API}/system-reset`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResetDialogOpen(false);
      setResetConfirmText('');
      showSuccess('System reset successful! All data cleared except super admin. Reloading...');
      // Reload page after short delay to refresh all data
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('Reset error:', err);
      showError(err.response?.data?.detail || 'Failed to reset system. Check console for details.');
    } finally {
      setResetting(false);
    }
  };

  // ==================== 2FA (Super Admin only) ====================
  const refreshTwoFactorStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API}/auth/2fa/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTwoFactorStatus(res.data);
    } catch (e) {
      // ignore
    }
  };

  const startTwoFactorSetup = async () => {
    const token = localStorage.getItem('token');
    setTwoFaLoading(true);
    try {
      const res = await axios.post(`${API}/auth/2fa/setup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTwoFactorSetup(res.data);
      setVerifyCode('');
      setSetupDialogOpen(true);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to start 2FA setup');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const verifyAndEnableTwoFactor = async () => {
    const code = (verifyCode || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) {
      showError('Please enter the 6-digit code from your authenticator app');
      return;
    }
    const token = localStorage.getItem('token');
    setTwoFaLoading(true);
    try {
      const res = await axios.post(`${API}/auth/2fa/enable`, { code }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBackupCodes(res.data.backup_codes || []);
      setSetupDialogOpen(false);
      setVerifyCode('');
      setTwoFactorSetup(null);
      setBackupCodesDialogOpen(true);
      await refreshTwoFactorStatus();
      showSuccess('Two-factor authentication enabled');
    } catch (err) {
      showError(err.response?.data?.detail || 'Invalid code. Please try again.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!disablePassword) {
      showError('Enter your password to disable 2FA');
      return;
    }
    const token = localStorage.getItem('token');
    setTwoFaLoading(true);
    try {
      await axios.post(`${API}/auth/2fa/disable`, { password: disablePassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDisableDialogOpen(false);
      setDisablePassword('');
      await refreshTwoFactorStatus();
      showSuccess('Two-factor authentication disabled');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to disable 2FA');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    const code = (regenCode || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) {
      showError('Enter the current 6-digit code from your authenticator app');
      return;
    }
    const token = localStorage.getItem('token');
    setTwoFaLoading(true);
    try {
      const res = await axios.post(`${API}/auth/2fa/regenerate-backup-codes`, { code }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBackupCodes(res.data.backup_codes || []);
      setRegenDialogOpen(false);
      setRegenCode('');
      setBackupCodesDialogOpen(true);
      await refreshTwoFactorStatus();
      showSuccess('New backup codes generated');
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to regenerate backup codes');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text).then(
      () => showSuccess('Backup codes copied to clipboard'),
      () => showError('Failed to copy backup codes')
    );
  };

  const downloadBackupCodes = () => {
    const text = `US Bakers India - 2FA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join('\n')}\n\nKeep these codes safe. Each code can be used only once.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usbakers-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <LayoutWithSidebar>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold" style={{ color: '#e92587' }}>Settings</h2>
          <p className="text-gray-600 mt-1">Configure system settings and preferences</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* SECTION 1: System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="mr-2 h-5 w-5" style={{ color: '#e92587' }} />
              System Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Global Payment Threshold */}
            <div className="space-y-2">
              <Label>Global Minimum Payment Percentage (%)</Label>
              <div className="flex gap-4 items-center">
                <Input
                  type="number"
                  value={systemSettings.minimum_payment_percentage}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    minimum_payment_percentage: parseFloat(e.target.value)
                  })}
                  className="max-w-xs"
                  min="0"
                  max="100"
                />
                <span className="text-sm text-gray-600">
                  Orders need this % payment to move from Pending to Manage Orders
                </span>
              </div>
            </div>

            {/* Birthday Mandatory Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Birthday Field</Label>
                <p className="text-sm text-gray-600">
                  Make birthday field mandatory when creating orders
                </p>
              </div>
              <Switch
                checked={systemSettings.birthday_mandatory}
                onCheckedChange={(checked) => setSystemSettings({
                  ...systemSettings,
                  birthday_mandatory: checked
                })}
              />
            </div>

            {/* Max Orders Per Time Slot */}
            <div className="space-y-2">
              <Label>Max Orders per Delivery Time Slot</Label>
              <div className="flex gap-4 items-center">
                <Input
                  type="number"
                  min="0"
                  value={systemSettings.max_orders_per_time_slot ?? 0}
                  onChange={(e) => setSystemSettings({
                    ...systemSettings,
                    max_orders_per_time_slot: parseInt(e.target.value || '0', 10)
                  })}
                  className="max-w-xs"
                  data-testid="max-orders-per-slot-input"
                />
                <span className="text-sm text-gray-600">
                  0 = unlimited. Otherwise, prevents booking the same outlet+date+time slot more than this many orders.
                </span>
              </div>
            </div>

            <Button
              onClick={updateSystemSettings}
              disabled={loading}
              className="text-white"
              style={{ backgroundColor: '#e92587' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save System Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* SECTION 2: Branch Payment Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Branch-Specific Payment Thresholds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Set different payment thresholds for specific branches (overrides global setting)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Select Branch</Label>
                <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Threshold (%)</Label>
                <Input
                  type="number"
                  value={outletThreshold}
                  onChange={(e) => setOutletThreshold(parseFloat(e.target.value))}
                  min="0"
                  max="100"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={setBranchThreshold}
                  disabled={loading}
                  className="w-full text-white"
                  style={{ backgroundColor: '#e92587' }}
                >
                  Set Threshold
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: Cake Flavours */}
        <Card>
          <CardHeader>
            <CardTitle>Cake Flavours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Enter flavour name (e.g., Chocolate, Vanilla)"
                value={newFlavour}
                onChange={(e) => setNewFlavour(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addFlavour()}
              />
              <Button
                onClick={addFlavour}
                disabled={loading}
                className="text-white whitespace-nowrap"
                style={{ backgroundColor: '#e92587' }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Flavour
              </Button>
            </div>

            {flavours.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flavour Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flavours.map((flavour) => (
                    <TableRow key={flavour.id}>
                      <TableCell>{flavour.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFlavour(flavour.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No flavours added yet</p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 4: Occasions */}
        <Card>
          <CardHeader>
            <CardTitle>Occasions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Enter occasion name (e.g., Birthday, Anniversary)"
                value={newOccasion}
                onChange={(e) => setNewOccasion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addOccasion()}
              />
              <Button
                onClick={addOccasion}
                disabled={loading}
                className="text-white whitespace-nowrap"
                style={{ backgroundColor: '#e92587' }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Occasion
              </Button>
            </div>

            {occasions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Occasion Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occasions.map((occasion) => (
                    <TableRow key={occasion.id}>
                      <TableCell>{occasion.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteOccasion(occasion.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No occasions added yet</p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 5: Delivery Time Slots */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Delivery Time Slots
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Start Time</Label>
                  <div className="flex gap-1">
                    <Select value={slotStartHour} onValueChange={setSlotStartHour}>
                      <SelectTrigger className="w-[70px]" data-testid="start-hour-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="flex items-center font-bold">:</span>
                    <Select value={slotStartMinute} onValueChange={setSlotStartMinute}>
                      <SelectTrigger className="w-[70px]" data-testid="start-minute-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['00', '15', '30', '45'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={slotStartPeriod} onValueChange={setSlotStartPeriod}>
                      <SelectTrigger className="w-[70px]" data-testid="start-period-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <span className="flex items-center pb-1 text-gray-400 font-medium">to</span>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">End Time</Label>
                  <div className="flex gap-1">
                    <Select value={slotEndHour} onValueChange={setSlotEndHour}>
                      <SelectTrigger className="w-[70px]" data-testid="end-hour-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="flex items-center font-bold">:</span>
                    <Select value={slotEndMinute} onValueChange={setSlotEndMinute}>
                      <SelectTrigger className="w-[70px]" data-testid="end-minute-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['00', '15', '30', '45'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={slotEndPeriod} onValueChange={setSlotEndPeriod}>
                      <SelectTrigger className="w-[70px]" data-testid="end-period-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={addTimeSlot}
                  disabled={loading}
                  className="text-white whitespace-nowrap"
                  style={{ backgroundColor: '#e92587' }}
                  data-testid="add-time-slot-btn"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Time Slot
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Preview: {slotStartHour}:{slotStartMinute} {slotStartPeriod} - {slotEndHour}:{slotEndMinute} {slotEndPeriod}
              </p>
            </div>

            {timeSlots.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time Slot</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeSlots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>{slot.time_slot}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTimeSlot(slot.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No time slots added yet</p>
            )}
          </CardContent>
        </Card>

        {/* SECTION 6: Two-Factor Authentication (Super Admin only) */}
        {isSuperAdmin && (
          <Card data-testid="two-factor-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" style={{ color: '#e92587' }} />
                Two-Factor Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-medium">
                    Status:{' '}
                    {twoFactorStatus.is_two_factor_enabled ? (
                      <span className="text-green-600" data-testid="two-factor-status-enabled">Enabled</span>
                    ) : (
                      <span className="text-gray-600" data-testid="two-factor-status-disabled">Disabled</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    Protect your Super Admin account using Google Authenticator or any TOTP app.
                  </p>
                  {twoFactorStatus.is_two_factor_enabled && (
                    <p className="text-xs text-gray-500 mt-1" data-testid="two-factor-backup-remaining">
                      Backup codes remaining: <span className="font-semibold">{twoFactorStatus.remaining_backup_codes}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!twoFactorStatus.is_two_factor_enabled ? (
                    <Button
                      onClick={startTwoFactorSetup}
                      disabled={twoFaLoading}
                      className="text-white"
                      style={{ backgroundColor: '#e92587' }}
                      data-testid="two-factor-enable-btn"
                    >
                      {twoFaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      Enable 2FA
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => { setRegenCode(''); setRegenDialogOpen(true); }}
                        data-testid="two-factor-regen-btn"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate Backup Codes
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => { setDisablePassword(''); setDisableDialogOpen(true); }}
                        data-testid="two-factor-disable-btn"
                      >
                        <ShieldOff className="mr-2 h-4 w-4" />
                        Disable 2FA
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION 7: Reset System (Danger Zone) */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Reset System</p>
                <p className="text-sm text-gray-500">Permanently delete all orders, payments, users (except super admin), outlets, zones, and all other data.</p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setResetDialogOpen(true)}
                data-testid="reset-system-btn"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Reset System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reset Confirmation Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Reset Entire System
              </DialogTitle>
              <DialogDescription>
                This action will permanently delete ALL data including orders, payments, customers, outlets, zones, users, flavours, occasions, and time slots. Only the super admin account will be preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm font-medium">Type <span className="font-bold text-red-600">RESET</span> to confirm:</p>
              <Input
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Type RESET to confirm"
                data-testid="reset-confirm-input"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResetDialogOpen(false); setResetConfirmText(''); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleResetSystem}
                disabled={resetConfirmText !== 'RESET' || resetting}
                data-testid="reset-confirm-btn"
              >
                {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                {resetting ? 'Resetting...' : 'Reset Everything'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2FA Setup Dialog */}
        <Dialog open={setupDialogOpen} onOpenChange={(open) => { if (!open) { setSetupDialogOpen(false); setVerifyCode(''); } }}>
          <DialogContent className="max-w-lg" data-testid="two-factor-setup-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" style={{ color: '#e92587' }} />
                Set up Two-Factor Authentication
              </DialogTitle>
              <DialogDescription>
                Scan this QR code with Google Authenticator (or any TOTP app), then enter the 6-digit code to enable 2FA.
              </DialogDescription>
            </DialogHeader>
            {twoFactorSetup && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={twoFactorSetup.qr_code}
                    alt="2FA QR Code"
                    className="w-48 h-48 border rounded-md"
                    data-testid="two-factor-qr-code"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Or enter this secret manually:</p>
                  <code
                    className="block text-xs bg-gray-100 px-3 py-2 rounded font-mono break-all"
                    data-testid="two-factor-secret"
                  >
                    {twoFactorSetup.secret}
                  </code>
                </div>
                <div>
                  <Label htmlFor="totp-code">6-digit code from authenticator</Label>
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-lg tracking-widest mt-1"
                    data-testid="two-factor-verify-code-input"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSetupDialogOpen(false); setVerifyCode(''); }} data-testid="two-factor-setup-cancel-btn">
                Cancel
              </Button>
              <Button
                onClick={verifyAndEnableTwoFactor}
                disabled={twoFaLoading || verifyCode.length !== 6}
                className="text-white"
                style={{ backgroundColor: '#e92587' }}
                data-testid="two-factor-verify-btn"
              >
                {twoFaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify & Enable
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Backup Codes Display Dialog */}
        <Dialog open={backupCodesDialogOpen} onOpenChange={setBackupCodesDialogOpen}>
          <DialogContent className="max-w-md" data-testid="backup-codes-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" style={{ color: '#e92587' }} />
                Save Your Backup Codes
              </DialogTitle>
              <DialogDescription>
                Store these 8 backup codes in a safe place. Each code can be used only once if you lose access to your authenticator. They will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 py-2" data-testid="backup-codes-list">
              {backupCodes.map((code, idx) => (
                <code
                  key={idx}
                  className="bg-gray-100 text-center font-mono text-sm py-2 rounded"
                  data-testid={`backup-code-${idx}`}
                >
                  {code}
                </code>
              ))}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={copyBackupCodes} data-testid="backup-codes-copy-btn">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" onClick={downloadBackupCodes} data-testid="backup-codes-download-btn">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                onClick={() => { setBackupCodesDialogOpen(false); setBackupCodes([]); }}
                className="text-white"
                style={{ backgroundColor: '#e92587' }}
                data-testid="backup-codes-done-btn"
              >
                I've Saved Them
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Disable 2FA Dialog */}
        <Dialog open={disableDialogOpen} onOpenChange={(open) => { if (!open) { setDisableDialogOpen(false); setDisablePassword(''); } }}>
          <DialogContent data-testid="two-factor-disable-dialog">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <ShieldOff className="h-5 w-5" />
                Disable Two-Factor Authentication
              </DialogTitle>
              <DialogDescription>
                Confirm your password to disable 2FA. Your authenticator and backup codes will be removed.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1"
                data-testid="two-factor-disable-password-input"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDisableDialogOpen(false); setDisablePassword(''); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={disableTwoFactor}
                disabled={twoFaLoading || !disablePassword}
                data-testid="two-factor-disable-confirm-btn"
              >
                {twoFaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                Disable 2FA
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerate Backup Codes Dialog */}
        <Dialog open={regenDialogOpen} onOpenChange={(open) => { if (!open) { setRegenDialogOpen(false); setRegenCode(''); } }}>
          <DialogContent data-testid="two-factor-regen-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" style={{ color: '#e92587' }} />
                Regenerate Backup Codes
              </DialogTitle>
              <DialogDescription>
                Enter the current 6-digit code from your authenticator. Your existing backup codes will be invalidated.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Label htmlFor="regen-code">Authenticator code</Label>
              <Input
                id="regen-code"
                inputMode="numeric"
                maxLength={6}
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center text-lg tracking-widest mt-1"
                data-testid="two-factor-regen-code-input"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRegenDialogOpen(false); setRegenCode(''); }}>
                Cancel
              </Button>
              <Button
                onClick={regenerateBackupCodes}
                disabled={twoFaLoading || regenCode.length !== 6}
                className="text-white"
                style={{ backgroundColor: '#e92587' }}
                data-testid="two-factor-regen-confirm-btn"
              >
                {twoFaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regenerate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </LayoutWithSidebar>
  );
};

export default Settings;
