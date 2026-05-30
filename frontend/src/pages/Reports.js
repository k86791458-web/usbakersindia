import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, DollarSign, Truck, Download, BarChart3, Users, Package, Store } from 'lucide-react';
import * as XLSX from 'xlsx';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PRESET_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'current_month', label: 'Current month' },
  { value: 'custom', label: 'Custom' },
];

const toISODate = (d) => d.toISOString().split('T')[0];

const computePresetRange = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === 'today') {
    return { start: toISODate(today), end: toISODate(today) };
  }
  if (preset === 'last_7') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { start: toISODate(start), end: toISODate(today) };
  }
  if (preset === 'last_30') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { start: toISODate(start), end: toISODate(today) };
  }
  if (preset === 'current_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toISODate(start), end: toISODate(today) };
  }
  return null;
};

const fmtMoney = (v) => `₹${(Number(v) || 0).toFixed(2)}`;

const Reports = () => {
  const { user } = useAuth();
  const [outlets, setOutlets] = useState([]);

  // ============ LEGACY FILTERS (Orders/Payments/Delivery) ============
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    outlet_id: 'all'
  });
  const [loading, setLoading] = useState(false);
  const [orderReport, setOrderReport] = useState(null);
  const [paymentReport, setPaymentReport] = useState(null);
  const [deliveryReport, setDeliveryReport] = useState(null);

  // ============ CUSTOM REPORT FILTERS ============
  const initialRange = computePresetRange('current_month');
  const [customPreset, setCustomPreset] = useState('current_month');
  const [customStart, setCustomStart] = useState(initialRange.start);
  const [customEnd, setCustomEnd] = useState(initialRange.end);
  const [customOutlet, setCustomOutlet] = useState('all');
  const [customLimit] = useState(10);
  const [customLoading, setCustomLoading] = useState(false);
  const [customSubTab, setCustomSubTab] = useState('sales-summary');

  const [salesSummary, setSalesSummary] = useState(null);
  const [topCustomers, setTopCustomers] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [outletPerformance, setOutletPerformance] = useState(null);

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    if (customPreset !== 'custom') {
      const r = computePresetRange(customPreset);
      if (r) {
        setCustomStart(r.start);
        setCustomEnd(r.end);
      }
    }
  }, [customPreset]);

  const fetchOutlets = async () => {
    try {
      const response = await axios.get(`${API}/outlets`);
      setOutlets(response.data);
    } catch (error) {
      console.error('Failed to fetch outlets:', error);
    }
  };

  // ============ LEGACY REPORT FETCHERS ============
  const fetchOrderReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', filters.start_date);
      params.append('end_date', filters.end_date);
      if (filters.outlet_id && filters.outlet_id !== 'all') params.append('outlet_id', filters.outlet_id);
      const response = await axios.get(`${API}/reports/orders?${params}`);
      setOrderReport(response.data);
    } catch (error) {
      console.error('Failed to fetch order report:', error);
      alert('Failed to fetch order report');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', filters.start_date + 'T00:00:00');
      params.append('end_date', filters.end_date + 'T23:59:59');
      if (filters.outlet_id && filters.outlet_id !== 'all') params.append('outlet_id', filters.outlet_id);
      const response = await axios.get(`${API}/reports/payments?${params}`);
      setPaymentReport(response.data);
    } catch (error) {
      console.error('Failed to fetch payment report:', error);
      alert('Failed to fetch payment report');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', filters.start_date);
      params.append('end_date', filters.end_date);
      if (filters.outlet_id && filters.outlet_id !== 'all') params.append('outlet_id', filters.outlet_id);
      const response = await axios.get(`${API}/reports/delivery?${params}`);
      setDeliveryReport(response.data);
    } catch (error) {
      console.error('Failed to fetch delivery report:', error);
      alert('Failed to fetch delivery report');
    } finally {
      setLoading(false);
    }
  };

  // ============ LEGACY EXPORTS ============
  const exportOrdersToExcel = () => {
    if (!orderReport) return;
    const ws_data = [
      ['Order Report'],
      ['Period', `${filters.start_date} to ${filters.end_date}`],
      [],
      ['Summary'],
      ['Total Orders', orderReport.summary.total_orders],
      ['Total Amount', orderReport.summary.total_amount],
      ['Total Paid', orderReport.summary.total_paid],
      ['Total Pending', orderReport.summary.total_pending],
      [],
      ['Order Number', 'Customer', 'Phone', 'Outlet', 'Order Type', 'Status', 'Delivery Date', 'Amount', 'Paid', 'Pending']
    ];
    orderReport.orders.forEach(order => {
      ws_data.push([
        order.order_number,
        order.customer_info?.name || 'N/A',
        order.customer_info?.phone || 'N/A',
        order.outlet_name,
        order.order_type,
        order.status,
        order.delivery_date,
        order.total_amount,
        order.paid_amount,
        order.pending_amount
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `orders_report_${filters.start_date}_to_${filters.end_date}.xlsx`);
  };

  const exportPaymentsToExcel = () => {
    if (!paymentReport) return;
    const ws_data = [
      ['Payment Report'],
      ['Period', `${filters.start_date} to ${filters.end_date}`],
      [],
      ['Summary'],
      ['Total Payments', paymentReport.summary.total_payments],
      ['Total Collected', paymentReport.summary.total_collected],
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    XLSX.writeFile(wb, `payments_report_${filters.start_date}_to_${filters.end_date}.xlsx`);
  };

  const exportDeliveryToExcel = () => {
    if (!deliveryReport) return;
    const ws_data = [
      ['Delivery Report'],
      ['Period', `${filters.start_date} to ${filters.end_date}`],
      [],
      ['Summary'],
      ['Total Deliveries', deliveryReport.summary.total_delivery_orders],
      ['Delivered', deliveryReport.summary.delivered],
      ['In Transit', deliveryReport.summary.in_transit],
      ['Pending', deliveryReport.summary.pending_delivery],
      ['Delivery Rate %', deliveryReport.summary.delivery_rate],
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deliveries');
    XLSX.writeFile(wb, `delivery_report_${filters.start_date}_to_${filters.end_date}.xlsx`);
  };

  // ============ CUSTOM REPORT FETCHERS ============
  const customParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append('start_date', customStart);
    p.append('end_date', customEnd);
    if (customOutlet && customOutlet !== 'all') p.append('outlet_id', customOutlet);
    return p;
  }, [customStart, customEnd, customOutlet]);

  const generateCustomReport = async () => {
    setCustomLoading(true);
    try {
      const endpoint = customSubTab;
      const params = new URLSearchParams(customParams.toString());
      if (endpoint === 'top-customers' || endpoint === 'top-products') {
        params.append('limit', String(customLimit));
      }
      const url = `${API}/reports/${endpoint}?${params.toString()}`;
      const res = await axios.get(url);
      if (endpoint === 'sales-summary') setSalesSummary(res.data);
      else if (endpoint === 'top-customers') setTopCustomers(res.data);
      else if (endpoint === 'top-products') setTopProducts(res.data);
      else if (endpoint === 'outlet-performance') setOutletPerformance(res.data);
    } catch (err) {
      console.error('Custom report error:', err);
      alert(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setCustomLoading(false);
    }
  };

  const exportCurrentCustomToExcel = () => {
    const period = `${customStart} to ${customEnd}`;
    const wb = XLSX.utils.book_new();
    let ws_data = [];
    let sheet = 'Report';
    let filename = `report_${customStart}_to_${customEnd}.xlsx`;

    if (customSubTab === 'sales-summary' && salesSummary) {
      const s = salesSummary.summary || {};
      ws_data = [
        ['Sales Summary'], ['Period', period], [],
        ['Total Orders', s.total_orders],
        ['Total Revenue', s.total_revenue],
        ['Total Paid', s.total_paid],
        ['Total Pending', s.total_pending],
        ['Total Discount', s.total_discount],
        ['Total Delivery Charge', s.total_delivery_charge],
        ['Average Order Value', s.average_order_value],
        ['Delivery Orders', s.delivery_orders],
        ['Pickup Orders', s.pickup_orders],
        [], ['Daily Trend'],
        ['Date', 'Orders', 'Revenue', 'Paid', 'Pending'],
      ];
      (salesSummary.daily_trend || []).forEach(d => {
        ws_data.push([d.date, d.orders, d.revenue, d.paid, d.pending]);
      });
      ws_data.push([], ['Status Breakdown']);
      Object.entries(salesSummary.status_breakdown || {}).forEach(([k, v]) => ws_data.push([k, v]));
      ws_data.push([], ['Payment Method Split']);
      Object.entries(salesSummary.payment_method_split || {}).forEach(([k, v]) => ws_data.push([k, v]));
      sheet = 'SalesSummary';
      filename = `sales_summary_${customStart}_to_${customEnd}.xlsx`;
    } else if (customSubTab === 'top-customers' && topCustomers) {
      ws_data = [
        ['Top Customers'], ['Period', period], ['Limit', topCustomers.limit], [],
        ['Customer Name', 'Phone', 'Orders', 'Total Spend', 'Total Paid', 'Total Pending', 'Last Order Date']
      ];
      (topCustomers.customers || []).forEach(c => {
        ws_data.push([c.customer_name, c.customer_phone, c.orders_count, c.total_spend, c.total_paid, c.total_pending, c.last_order_date]);
      });
      sheet = 'TopCustomers';
      filename = `top_customers_${customStart}_to_${customEnd}.xlsx`;
    } else if (customSubTab === 'top-products' && topProducts) {
      ws_data = [
        ['Top Products'], ['Period', period], ['Limit', topProducts.limit], [],
        ['Product (Flavour)', 'Orders', 'Total Revenue', 'Total Pounds']
      ];
      (topProducts.products || []).forEach(p => {
        ws_data.push([p.product, p.orders_count, p.total_revenue, p.total_pounds]);
      });
      sheet = 'TopProducts';
      filename = `top_products_${customStart}_to_${customEnd}.xlsx`;
    } else if (customSubTab === 'outlet-performance' && outletPerformance) {
      ws_data = [
        ['Outlet Performance'], ['Period', period], [],
        ['Outlet', 'Orders', 'Revenue', 'Paid', 'Pending', 'AOV', 'Delivery Orders', 'Delivered', 'Cancelled', 'Delivery Completion %']
      ];
      (outletPerformance.outlets || []).forEach(o => {
        ws_data.push([
          o.outlet_name, o.orders_count, o.total_revenue, o.total_paid, o.total_pending,
          o.average_order_value, o.delivery_orders, o.delivered_orders, o.cancelled_orders, o.delivery_completion_rate
        ]);
      });
      sheet = 'OutletPerformance';
      filename = `outlet_performance_${customStart}_to_${customEnd}.xlsx`;
    } else {
      alert('Generate the report first before exporting.');
      return;
    }

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, filename);
  };

  const renderCustomFilterBar = () => (
    <Card data-testid="custom-reports-filter-card">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>Date Range</Label>
            <Select value={customPreset} onValueChange={setCustomPreset}>
              <SelectTrigger data-testid="custom-date-preset"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESET_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={customStart}
              disabled={customPreset !== 'custom'}
              onChange={(e) => setCustomStart(e.target.value)}
              data-testid="custom-start-date"
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={customEnd}
              disabled={customPreset !== 'custom'}
              onChange={(e) => setCustomEnd(e.target.value)}
              data-testid="custom-end-date"
            />
          </div>
          {user?.role === 'super_admin' && customSubTab !== 'outlet-performance' && (
            <div>
              <Label>Outlet</Label>
              <Select value={customOutlet} onValueChange={setCustomOutlet}>
                <SelectTrigger data-testid="custom-outlet-select"><SelectValue placeholder="All Outlets" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets</SelectItem>
                  {outlets.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              onClick={generateCustomReport}
              disabled={customLoading}
              className="text-white"
              style={{ backgroundColor: '#e92587' }}
              data-testid="custom-generate-btn"
            >
              {customLoading ? 'Loading...' : 'Generate'}
            </Button>
            <Button variant="outline" onClick={exportCurrentCustomToExcel} data-testid="custom-export-btn">
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <LayoutWithSidebar>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: '#e92587' }}>Reports</h1>

        {/* Top-level: Custom Reports | Legacy */}
        <Tabs defaultValue="custom" className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-2" data-testid="reports-top-tabs">
            <TabsTrigger value="custom" data-testid="reports-tab-custom">
              <BarChart3 className="h-4 w-4 mr-2" /> Custom Reports
            </TabsTrigger>
            <TabsTrigger value="legacy" data-testid="reports-tab-legacy">
              <FileText className="h-4 w-4 mr-2" /> Standard Reports
            </TabsTrigger>
          </TabsList>

          {/* ============ CUSTOM REPORTS ============ */}
          <TabsContent value="custom" className="space-y-4">
            {renderCustomFilterBar()}

            <Tabs value={customSubTab} onValueChange={setCustomSubTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4" data-testid="custom-subtabs">
                <TabsTrigger value="sales-summary" data-testid="subtab-sales-summary">
                  <DollarSign className="h-4 w-4 mr-1" /> Sales Summary
                </TabsTrigger>
                <TabsTrigger value="top-customers" data-testid="subtab-top-customers">
                  <Users className="h-4 w-4 mr-1" /> Top Customers
                </TabsTrigger>
                <TabsTrigger value="top-products" data-testid="subtab-top-products">
                  <Package className="h-4 w-4 mr-1" /> Top Products
                </TabsTrigger>
                <TabsTrigger value="outlet-performance" data-testid="subtab-outlet-performance">
                  <Store className="h-4 w-4 mr-1" /> Outlet Performance
                </TabsTrigger>
              </TabsList>

              {/* Sales Summary */}
              <TabsContent value="sales-summary">
                <Card>
                  <CardHeader><CardTitle>Sales Summary</CardTitle></CardHeader>
                  <CardContent>
                    {!salesSummary ? (
                      <p className="text-sm text-gray-500">Click <b>Generate</b> to load the report.</p>
                    ) : (
                      <div className="space-y-4" data-testid="sales-summary-content">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{salesSummary.summary.total_orders}</div><p className="text-sm text-gray-500">Total Orders</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{fmtMoney(salesSummary.summary.total_revenue)}</div><p className="text-sm text-gray-500">Total Revenue</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{fmtMoney(salesSummary.summary.total_paid)}</div><p className="text-sm text-gray-500">Total Paid</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-orange-600">{fmtMoney(salesSummary.summary.total_pending)}</div><p className="text-sm text-gray-500">Total Pending</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-xl font-bold">{fmtMoney(salesSummary.summary.average_order_value)}</div><p className="text-sm text-gray-500">Avg Order Value</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-xl font-bold">{fmtMoney(salesSummary.summary.total_discount)}</div><p className="text-sm text-gray-500">Discount</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-xl font-bold">{salesSummary.summary.delivery_orders}</div><p className="text-sm text-gray-500">Delivery Orders</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-xl font-bold">{salesSummary.summary.pickup_orders}</div><p className="text-sm text-gray-500">Pickup Orders</p></CardContent></Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader><CardTitle className="text-lg">Status Breakdown</CardTitle></CardHeader>
                            <CardContent>
                              <Table>
                                <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Orders</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {Object.entries(salesSummary.status_breakdown || {}).map(([k, v]) => (
                                    <TableRow key={k}><TableCell className="capitalize">{k}</TableCell><TableCell className="text-right">{v}</TableCell></TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader><CardTitle className="text-lg">Payment Method Split</CardTitle></CardHeader>
                            <CardContent>
                              <Table>
                                <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                <TableBody>
                                  {Object.entries(salesSummary.payment_method_split || {}).map(([k, v]) => (
                                    <TableRow key={k}><TableCell className="capitalize">{k}</TableCell><TableCell className="text-right">{fmtMoney(v)}</TableCell></TableRow>
                                  ))}
                                  {Object.keys(salesSummary.payment_method_split || {}).length === 0 && (
                                    <TableRow><TableCell colSpan={2} className="text-center text-gray-500">No payments in range</TableCell></TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        </div>

                        <Card>
                          <CardHeader><CardTitle className="text-lg">Daily Revenue Trend</CardTitle></CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead><TableHead className="text-right">Orders</TableHead>
                                  <TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Paid</TableHead>
                                  <TableHead className="text-right">Pending</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(salesSummary.daily_trend || []).map(d => (
                                  <TableRow key={d.date}>
                                    <TableCell>{d.date}</TableCell>
                                    <TableCell className="text-right">{d.orders}</TableCell>
                                    <TableCell className="text-right">{fmtMoney(d.revenue)}</TableCell>
                                    <TableCell className="text-right text-green-600">{fmtMoney(d.paid)}</TableCell>
                                    <TableCell className="text-right text-orange-600">{fmtMoney(d.pending)}</TableCell>
                                  </TableRow>
                                ))}
                                {(salesSummary.daily_trend || []).length === 0 && (
                                  <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No data</TableCell></TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Top Customers */}
              <TabsContent value="top-customers">
                <Card>
                  <CardHeader><CardTitle>Top Customers (Top {customLimit})</CardTitle></CardHeader>
                  <CardContent>
                    {!topCustomers ? (
                      <p className="text-sm text-gray-500">Click <b>Generate</b> to load the report.</p>
                    ) : (
                      <div data-testid="top-customers-content">
                        <p className="text-sm text-gray-500 mb-2">
                          Total unique customers in range: <b>{topCustomers.total_unique_customers}</b>
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead>Phone</TableHead>
                              <TableHead className="text-right">Orders</TableHead>
                              <TableHead className="text-right">Total Spend</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Pending</TableHead>
                              <TableHead>Last Order</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(topCustomers.customers || []).map((c, idx) => (
                              <TableRow key={`${c.customer_phone || c.customer_name}-${idx}`}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell className="font-medium">{c.customer_name}</TableCell>
                                <TableCell>{c.customer_phone || '-'}</TableCell>
                                <TableCell className="text-right">{c.orders_count}</TableCell>
                                <TableCell className="text-right font-semibold">{fmtMoney(c.total_spend)}</TableCell>
                                <TableCell className="text-right text-green-600">{fmtMoney(c.total_paid)}</TableCell>
                                <TableCell className="text-right text-orange-600">{fmtMoney(c.total_pending)}</TableCell>
                                <TableCell>{c.last_order_date || '-'}</TableCell>
                              </TableRow>
                            ))}
                            {(topCustomers.customers || []).length === 0 && (
                              <TableRow><TableCell colSpan={8} className="text-center text-gray-500">No customers in range</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Top Products */}
              <TabsContent value="top-products">
                <Card>
                  <CardHeader><CardTitle>Top Products (Top {customLimit})</CardTitle></CardHeader>
                  <CardContent>
                    {!topProducts ? (
                      <p className="text-sm text-gray-500">Click <b>Generate</b> to load the report.</p>
                    ) : (
                      <div data-testid="top-products-content">
                        <p className="text-sm text-gray-500 mb-2">
                          Unique products in range: <b>{topProducts.total_unique_products}</b>
                        </p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead><TableHead>Product (Flavour)</TableHead>
                              <TableHead className="text-right">Orders</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">Total Pounds</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(topProducts.products || []).map((p, idx) => (
                              <TableRow key={`${p.product}-${idx}`}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell className="font-medium">{p.product}</TableCell>
                                <TableCell className="text-right">{p.orders_count}</TableCell>
                                <TableCell className="text-right font-semibold">{fmtMoney(p.total_revenue)}</TableCell>
                                <TableCell className="text-right">{p.total_pounds}</TableCell>
                              </TableRow>
                            ))}
                            {(topProducts.products || []).length === 0 && (
                              <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No products in range</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Outlet Performance */}
              <TabsContent value="outlet-performance">
                <Card>
                  <CardHeader><CardTitle>Outlet Performance</CardTitle></CardHeader>
                  <CardContent>
                    {!outletPerformance ? (
                      <p className="text-sm text-gray-500">Click <b>Generate</b> to load the report.</p>
                    ) : (
                      <div data-testid="outlet-performance-content">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead><TableHead>Outlet</TableHead>
                              <TableHead className="text-right">Orders</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Pending</TableHead>
                              <TableHead className="text-right">AOV</TableHead>
                              <TableHead className="text-right">Delivery Orders</TableHead>
                              <TableHead className="text-right">Delivered</TableHead>
                              <TableHead className="text-right">Cancelled</TableHead>
                              <TableHead className="text-right">Completion %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(outletPerformance.outlets || []).map((o, idx) => (
                              <TableRow key={o.outlet_id}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell className="font-medium">{o.outlet_name}</TableCell>
                                <TableCell className="text-right">{o.orders_count}</TableCell>
                                <TableCell className="text-right font-semibold">{fmtMoney(o.total_revenue)}</TableCell>
                                <TableCell className="text-right text-green-600">{fmtMoney(o.total_paid)}</TableCell>
                                <TableCell className="text-right text-orange-600">{fmtMoney(o.total_pending)}</TableCell>
                                <TableCell className="text-right">{fmtMoney(o.average_order_value)}</TableCell>
                                <TableCell className="text-right">{o.delivery_orders}</TableCell>
                                <TableCell className="text-right">{o.delivered_orders}</TableCell>
                                <TableCell className="text-right">{o.cancelled_orders}</TableCell>
                                <TableCell className="text-right">{o.delivery_completion_rate}%</TableCell>
                              </TableRow>
                            ))}
                            {(outletPerformance.outlets || []).length === 0 && (
                              <TableRow><TableCell colSpan={11} className="text-center text-gray-500">No outlet data in range</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ============ LEGACY STANDARD REPORTS ============ */}
          <TabsContent value="legacy" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Standard Report Filters</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={filters.start_date}
                      onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" value={filters.end_date}
                      onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} />
                  </div>
                  {user?.role === 'super_admin' && (
                    <div>
                      <Label>Outlet</Label>
                      <Select value={filters.outlet_id || 'all'} onValueChange={(v) => setFilters({ ...filters, outlet_id: v })}>
                        <SelectTrigger><SelectValue placeholder="All Outlets" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Outlets</SelectItem>
                          {outlets.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="orders" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="orders"><FileText className="h-4 w-4 mr-2" />Orders</TabsTrigger>
                <TabsTrigger value="payments"><DollarSign className="h-4 w-4 mr-2" />Payments</TabsTrigger>
                <TabsTrigger value="delivery"><Truck className="h-4 w-4 mr-2" />Delivery</TabsTrigger>
              </TabsList>

              <TabsContent value="orders">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Order Report</CardTitle>
                      <div className="flex gap-2">
                        {orderReport && (
                          <Button variant="outline" onClick={exportOrdersToExcel}>
                            <Download className="h-4 w-4 mr-2" />Export to Excel
                          </Button>
                        )}
                        <Button onClick={fetchOrderReport} disabled={loading}>
                          {loading ? 'Loading...' : 'Generate Report'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {orderReport && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{orderReport.summary.total_orders}</div><p className="text-sm text-gray-500">Total Orders</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{fmtMoney(orderReport.summary.total_amount)}</div><p className="text-sm text-gray-500">Total Amount</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{fmtMoney(orderReport.summary.total_paid)}</div><p className="text-sm text-gray-500">Total Paid</p></CardContent></Card>
                          <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-red-600">{fmtMoney(orderReport.summary.total_pending)}</div><p className="text-sm text-gray-500">Total Pending</p></CardContent></Card>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payments">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Payment Report</CardTitle>
                      <div className="flex gap-2">
                        {paymentReport && (
                          <Button variant="outline" onClick={exportPaymentsToExcel}>
                            <Download className="h-4 w-4 mr-2" />Export to Excel
                          </Button>
                        )}
                        <Button onClick={fetchPaymentReport} disabled={loading}>
                          {loading ? 'Loading...' : 'Generate Report'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {paymentReport && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{paymentReport.summary.total_payments}</div><p className="text-sm text-gray-500">Total Transactions</p></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{fmtMoney(paymentReport.summary.total_collected)}</div><p className="text-sm text-gray-500">Total Collected</p></CardContent></Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="delivery">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Delivery Report</CardTitle>
                      <div className="flex gap-2">
                        {deliveryReport && (
                          <Button variant="outline" onClick={exportDeliveryToExcel}>
                            <Download className="h-4 w-4 mr-2" />Export to Excel
                          </Button>
                        )}
                        <Button onClick={fetchDeliveryReport} disabled={loading}>
                          {loading ? 'Loading...' : 'Generate Report'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {deliveryReport && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{deliveryReport.summary.total_delivery_orders}</div><p className="text-sm text-gray-500">Total Deliveries</p></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{deliveryReport.summary.delivered}</div><p className="text-sm text-gray-500">Delivered</p></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-blue-600">{deliveryReport.summary.in_transit}</div><p className="text-sm text-gray-500">In Transit</p></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-yellow-600">{deliveryReport.summary.pending_delivery}</div><p className="text-sm text-gray-500">Pending</p></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{deliveryReport.summary.delivery_rate}%</div><p className="text-sm text-gray-500">Delivery Rate</p></CardContent></Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </LayoutWithSidebar>
  );
};

export default Reports;
