import { useEffect, useState } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gift, RefreshCw, Loader2, Download } from 'lucide-react';
import { exportRowsToExcel, fmtDateTime } from '../utils/excelExport';
import { formatBirthday } from '../utils/formatters';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ComplementaryOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const res = await axios.get(`${API}/orders/complementary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(res.data || []);
    } catch (_e) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  return (
    <LayoutWithSidebar>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2" style={{ color: '#e92587' }}>
              <Gift className="h-6 w-6" /> Complementary Orders
            </h2>
            <p className="text-gray-600 mt-1">Orders marked as complementary by Super Admin</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetch}
              className="border-pink-600 text-pink-600 hover:bg-pink-50"
              data-testid="complementary-refresh-btn"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => exportRowsToExcel(
                orders,
                [
                  { key: 'order_number', label: 'Order #' },
                  { key: 'customer_info', label: 'Customer Name', fmt: (v) => v?.name || '' },
                  { key: 'customer_info', label: 'Customer Phone', fmt: (v) => v?.phone || '' },
                  { key: 'customer_info', label: 'Birthday', fmt: (v) => formatBirthday(v?.birthday) },
                  { key: 'outlet_name', label: 'Outlet' },
                  { key: 'flavour', label: 'Flavour' },
                  { key: 'size_pounds', label: 'Size (lbs)' },
                  { key: 'occasion', label: 'Occasion' },
                  { key: 'delivery_date', label: 'Delivery Date' },
                  { key: 'delivery_time', label: 'Delivery Time' },
                  { key: 'total_amount', label: 'Total (₹)' },
                  { key: 'created_at', label: 'Booked At', fmt: fmtDateTime },
                ],
                'complementary_orders',
                'Complementary'
              )}
              data-testid="complementary-export-btn"
            >
              <Download className="mr-2 h-4 w-4" /> Export Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Complementary Orders ({orders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#e92587' }} />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500" data-testid="complementary-empty">
                No complementary orders yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Flavour / Size</TableHead>
                    <TableHead>Occasion</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Marked Complementary At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} data-testid={`complementary-row-${o.order_number}`}>
                      <TableCell className="font-medium">#{o.order_number}</TableCell>
                      <TableCell>
                        <div>{o.customer_info?.name}</div>
                        <div className="text-xs text-gray-500">{o.customer_info?.phone}</div>
                      </TableCell>
                      <TableCell>{o.flavour} · {o.size_pounds} lbs</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{o.occasion || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.delivery_date}
                        <div className="text-xs text-gray-500">{o.delivery_time}</div>
                      </TableCell>
                      <TableCell>₹{(o.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {o.updated_at ? new Date(o.updated_at).toLocaleString('en-IN') : '-'}
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

export default ComplementaryOrders;
