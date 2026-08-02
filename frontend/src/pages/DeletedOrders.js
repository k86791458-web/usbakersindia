import { useState, useEffect } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, RefreshCw, Loader2, CheckCircle, XCircle, ShieldAlert, Download } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { exportRowsToExcel, fmtDateTime } from '../utils/excelExport';
import { formatBirthday } from '../utils/formatters';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DeletedOrders = () => {
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [orders, setOrders] = useState([]);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('deleted');

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const reqs = [axios.get(`${API}/orders/deleted`, authHeaders)];
      if (isSuperAdmin) reqs.push(axios.get(`${API}/orders/delete-requests`, authHeaders));
      const res = await Promise.all(reqs);
      setOrders(res[0].data || []);
      if (isSuperAdmin) setPendingDeletes(res[1].data || []);
    } catch (error) {
      console.error('Failed to load delete data:', error);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id) => {
    try {
      await axios.post(`${API}/orders/${id}/approve-delete`, {}, authHeaders);
      refresh();
    } catch (e) {
      alert(e.response?.data?.detail || 'Approve failed');
    }
  };
  const reject = async (id) => {
    if (!window.confirm('Reject this delete request?')) return;
    try {
      await axios.post(`${API}/orders/${id}/reject-delete`, {}, authHeaders);
      refresh();
    } catch (e) {
      alert(e.response?.data?.detail || 'Reject failed');
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
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold" style={{ color: '#e92587' }}>Deleted Orders</h2>
            <p className="text-gray-600 mt-1">Order deletions and approval requests</p>
          </div>
          <div className="flex gap-2">
          <Button
            onClick={refresh}
            variant="outline"
            className="border-pink-600 text-pink-600 hover:bg-pink-50"
            data-testid="deleted-refresh-btn"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => exportRowsToExcel(
              orders,
              [
                { key: 'order_number', label: 'Order #' },
                { key: 'customer_info', label: 'Customer Name', fmt: (v) => v?.name || '' },
                { key: 'customer_info', label: 'Customer Phone', fmt: (v) => v?.phone || '' },
                { key: 'customer_info', label: 'Birthday', fmt: (v) => formatBirthday(v?.birthday) },
                { key: 'customer_info', label: 'Gender', fmt: (v) => v?.gender || '' },
                { key: 'flavour', label: 'Flavour' },
                { key: 'size_pounds', label: 'Size (lbs)' },
                { key: 'occasion', label: 'Occasion' },
                { key: 'name_on_cake', label: 'Name on Cake' },
                { key: 'delivery_date', label: 'Delivery Date' },
                { key: 'delivery_time', label: 'Delivery Time' },
                { key: 'total_amount', label: 'Total (₹)' },
                { key: 'paid_amount', label: 'Paid (₹)' },
                { key: 'pending_amount', label: 'Pending (₹)' },
                { key: 'deleted_from_lifecycle_status', label: 'Deleted From (Lifecycle)', fmt: (v, r) => v || r.deleted_from_status || r.lifecycle_status || '' },
                { key: 'deleted_from_status', label: 'Deleted From (Status)', fmt: (v, r) => v || r.status || '' },
                { key: 'delete_reason', label: 'Reason' },
                { key: 'delete_requested_by_name', label: 'Requested By' },
                { key: 'delete_approved_by_name', label: 'Approved By' },
                { key: 'updated_at', label: 'Deleted At', fmt: fmtDateTime },
                { key: 'created_at', label: 'Booked At', fmt: fmtDateTime },
              ],
              'deleted_orders',
              'DeletedOrders'
            )}
            variant="outline"
            className="border-pink-600 text-pink-600 hover:bg-pink-50"
            data-testid="deleted-export-btn"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="deleted" data-testid="tab-deleted">
              <Trash2 className="h-4 w-4 mr-1" /> Deleted ({orders.length})
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="pending" data-testid="tab-pending">
                <ShieldAlert className="h-4 w-4 mr-1" /> Pending Approvals ({pendingDeletes.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="deleted">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  Deleted Orders ({orders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No deleted orders</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Flavour / Size</TableHead>
                        <TableHead>Delivery</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Deleted From</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Approved By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        const stage = order.deleted_from_lifecycle_status || order.deleted_from_status || order.lifecycle_status || order.status || '—';
                        const stageLabel = String(stage).replace(/_/g, ' ');
                        return (
                        <TableRow key={order.id} className="bg-red-50/30" data-testid={`deleted-row-${order.order_number}`}>
                          <TableCell className="font-medium">
                            <div>{order.order_number}</div>
                            {order.occasion && (
                              <div className="text-xs text-gray-500">{order.occasion}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div>{order.customer_info?.name}</div>
                              <div className="text-xs text-gray-500">{order.customer_info?.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>{order.flavour || '-'}</div>
                            <div className="text-xs text-gray-500">{order.size_pounds ? `${order.size_pounds} lbs` : '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{order.delivery_date || '-'}</div>
                            <div className="text-xs text-gray-500">{order.delivery_time || ''}</div>
                          </TableCell>
                          <TableCell>₹{order.total_amount?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize" data-testid={`deleted-stage-${order.order_number}`}>
                              {stageLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="text-sm whitespace-pre-wrap break-words">{order.delete_reason || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.delete_approved_by_name || order.delete_approved_by || '-'}</Badge>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                    Pending Approvals ({pendingDeletes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingDeletes.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No pending requests</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Requested By</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingDeletes.map((o) => (
                          <TableRow key={o.id} className="bg-amber-50/40">
                            <TableCell className="font-medium">{o.order_number}</TableCell>
                            <TableCell>
                              <div>{o.customer_info?.name}</div>
                              <div className="text-xs text-gray-500">{o.customer_info?.phone}</div>
                            </TableCell>
                            <TableCell>₹{o.total_amount?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{o.delete_requested_by_name || o.delete_requested_by}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs">{o.delete_reason || '-'}</TableCell>
                            <TableCell className="space-x-2">
                              <Button size="sm" onClick={() => approve(o.id)} data-testid={`approve-${o.id}`}>
                                <CheckCircle className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => reject(o.id)} data-testid={`reject-${o.id}`}>
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </LayoutWithSidebar>
  );
};

export default DeletedOrders;
