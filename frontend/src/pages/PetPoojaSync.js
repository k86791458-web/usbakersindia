import { useEffect, useState } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, CheckCircle, XCircle, Clock, Loader2, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PetPoojaSync = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  // d4: Default view is unsynced-custom-cake bills only. 'synced' shows synced ones,
  // 'all' shows the full list including non-cake / already-synced bills.
  const [filter, setFilter] = useState('unsynced_custom');
  // d5: C16 short-code filter — 'all' | 'C16' | 'OTHER' | 'MIXED'
  const [shortcodeFilter, setShortcodeFilter] = useState('all');
  const [resyncOrders, setResyncOrders] = useState([]);

  useEffect(() => {
    fetchBills();
    fetchResyncOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, shortcodeFilter]);

  const fetchBills = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const params = {};
      // d4: Server-side filters
      if (filter === 'unsynced_custom') params.view = 'unsynced_custom';
      else if (filter === 'synced') params.synced = 'true';
      // d5
      if (shortcodeFilter !== 'all') params.shortcode = shortcodeFilter;

      const response = await axios.get(`${API}/petpooja-bills`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setBills(response.data);
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      setError('Failed to load PetPooja bills');
    } finally {
      setLoading(false);
    }
  };

  // d3: Orders that were edited after PetPooja bill was created — need manual re-sync in PetPooja.
  const fetchResyncOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/petpooja/needs-resync`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResyncOrders(res.data || []);
    } catch (err) {
      setResyncOrders([]);
    }
  };

  const clearResyncFlag = async (orderId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/orders/${orderId}/clear-bill-resync-flag`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Re-sync flag cleared');
      fetchResyncOrders();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError('Failed to clear re-sync flag');
      setTimeout(() => setError(''), 2500);
    }
  };

  const syncBill = async (billId) => {
    const token = localStorage.getItem('token');
    setSyncing(billId);
    try {
      await axios.post(`${API}/petpooja-bills/sync/${billId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Bill synced successfully!');
      fetchBills();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to sync bill');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSyncing(null);
    }
  };
  const filteredBills = bills;  // Filtering is now server-side (d4/d5)



  const getSyncStatus = (bill) => {
    if (bill.synced_to_order) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="mr-1 h-3 w-3" />
          Synced Successfully
        </Badge>
      );
    } else if (bill.sync_error) {
      return (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="mr-1 h-3 w-3" />
          Sync Failed
        </Badge>
      );
    } else if (!bill.has_custom_cake) {
      return (
        <Badge variant="outline" className="text-gray-600">
          No Custom Cake
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <Clock className="mr-1 h-3 w-3" />
          Pending Sync
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <LayoutWithSidebar>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#e92587' }} />
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold" style={{ color: '#e92587' }}>
              PetPooja Sync
            </h2>
            <p className="text-gray-600 mt-1">
              All PetPooja bills with sync status
            </p>
          </div>
          <Button
            onClick={fetchBills}
            variant="outline"
            className="border-pink-600 text-pink-600 hover:bg-pink-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
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

        {/* d3: Bill re-sync required banner */}
        {resyncOrders.length > 0 && (
          <Card className="border-orange-300 bg-orange-50" data-testid="petpooja-resync-banner">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-orange-800 text-lg">
                <AlertTriangle className="h-5 w-5" />
                {resyncOrders.length} order(s) need PetPooja bill re-sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-700 mb-3">
                These orders were edited after being billed in PetPooja. Update the bill in PetPooja
                and then click "Mark Re-Synced" to clear this flag.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Bill No(s)</TableHead>
                    <TableHead>Flagged At</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resyncOrders.map((o) => (
                    <TableRow key={o.id} data-testid={`resync-row-${o.order_number}`}>
                      <TableCell className="font-medium">#{o.order_number}</TableCell>
                      <TableCell>{o.customer_info?.name || '-'}</TableCell>
                      <TableCell>{o.outlet_name || '-'}</TableCell>
                      <TableCell>{(o.petpooja_bill_numbers || []).join(', ') || '-'}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {o.bill_resync_flagged_at ? new Date(o.bill_resync_flagged_at).toLocaleString('en-IN') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-600 text-orange-700 hover:bg-orange-100"
                          onClick={() => clearResyncFlag(o.id)}
                          data-testid={`resync-clear-btn-${o.order_number}`}
                        >
                          Mark Re-Synced
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <div className="rounded-full p-2 bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold">About PetPooja Sync</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Only bills containing "Custom Cake" items will be synced. You can manually sync pending bills or they will auto-sync when payment is received.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bills Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle>
                {filter === 'synced' ? 'Successfully Synced Bills'
                  : filter === 'unsynced_custom' ? 'Unsynced Custom-Cake Bills'
                  : 'All PetPooja Bills'} ({filteredBills.length})
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                {/* d4: three-way toggle */}
                <Button
                  size="sm"
                  variant={filter === 'unsynced_custom' ? 'default' : 'outline'}
                  onClick={() => setFilter('unsynced_custom')}
                  className={filter === 'unsynced_custom' ? 'text-white' : 'border-orange-600 text-orange-600'}
                  style={filter === 'unsynced_custom' ? { backgroundColor: '#ea580c' } : {}}
                  data-testid="petpooja-filter-unsynced-custom"
                >
                  Unsynced (Custom Cake)
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'synced' ? 'default' : 'outline'}
                  onClick={() => setFilter('synced')}
                  className={filter === 'synced' ? 'text-white' : 'border-pink-600 text-pink-600'}
                  style={filter === 'synced' ? { backgroundColor: '#e92587' } : {}}
                  data-testid="petpooja-filter-synced"
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Synced Only
                </Button>
                <Button
                  size="sm"
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  className={filter === 'all' ? 'text-white' : 'text-gray-600'}
                  style={filter === 'all' ? { backgroundColor: '#6b7280' } : {}}
                  data-testid="petpooja-filter-all"
                >
                  View All
                </Button>
                {/* d5: C16 short-code sub-filter */}
                <div className="flex items-center gap-1 border-l pl-2 ml-2">
                  <span className="text-xs text-gray-600 mr-1">Short-code:</span>
                  {['all', 'C16', 'OTHER', 'MIXED'].map((sc) => (
                    <Button
                      key={sc}
                      size="sm"
                      variant={shortcodeFilter === sc ? 'default' : 'outline'}
                      onClick={() => setShortcodeFilter(sc)}
                      className={shortcodeFilter === sc ? 'text-white' : ''}
                      style={shortcodeFilter === sc ? {
                        backgroundColor: sc === 'C16' ? '#10b981' : sc === 'OTHER' ? '#dc2626' : '#6b7280'
                      } : {}}
                      data-testid={`petpooja-shortcode-${sc}`}
                    >
                      {sc}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredBills.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {filter === 'synced' ? 'No synced bills found' : 'No PetPooja bills found'}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {filter === 'synced' 
                    ? 'Click "View All" to see all bills including pending ones'
                    : 'Bills will appear here when synced from PetPooja POS'
                  }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Number</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Has Custom Cake</TableHead>
                    <TableHead>Short Code</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill) => (
                    <TableRow key={bill.id} data-testid={`petpooja-bill-row-${bill.bill_number}`}>
                      <TableCell className="font-medium">{bill.bill_number}</TableCell>
                      <TableCell className="text-sm" data-testid={`petpooja-bill-outlet-${bill.bill_number}`}>
                        {bill.outlet_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{bill.customer_name || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{bill.customer_phone || 'N/A'}</div>
                        </div>
                      </TableCell>
                      <TableCell>₹{(bill.amount || bill.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {bill.has_custom_cake ? (
                          <Badge className="bg-green-100 text-green-800">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {bill.custom_cake_shortcode === 'C16' && (
                          <Badge className="bg-emerald-100 text-emerald-800" data-testid={`shortcode-badge-${bill.bill_number}`}>C16</Badge>
                        )}
                        {bill.custom_cake_shortcode === 'OTHER' && (
                          <Badge className="bg-red-100 text-red-800" data-testid={`shortcode-badge-${bill.bill_number}`}>OTHER — review</Badge>
                        )}
                        {bill.custom_cake_shortcode === 'MIXED' && (
                          <Badge className="bg-amber-100 text-amber-800" data-testid={`shortcode-badge-${bill.bill_number}`}>MIXED</Badge>
                        )}
                        {!bill.custom_cake_shortcode && bill.has_custom_cake && (
                          <Badge variant="outline" className="text-xs">n/a</Badge>
                        )}
                        {!bill.has_custom_cake && '-'}
                      </TableCell>
                      <TableCell>{getSyncStatus(bill)}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(bill.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {!bill.synced_to_order && bill.has_custom_cake && (
                          <Button
                            size="sm"
                            onClick={() => syncBill(bill.id)}
                            disabled={syncing === bill.id}
                            className="text-white"
                            style={{ backgroundColor: '#e92587' }}
                            data-testid={`sync-now-${bill.bill_number}`}
                          >
                            {syncing === bill.id ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              'Sync Now'
                            )}
                          </Button>
                        )}
                        {bill.synced_to_order && bill.order_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = `/orders/${bill.order_id}`}
                          >
                            View Order
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  );
};

export default PetPoojaSync;
