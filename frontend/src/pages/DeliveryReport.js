import { Fragment, useEffect, useState } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { formatTime12 } from '../utils/formatters';
import { exportRowsToExcel } from '../utils/excelExport';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDT = (v) => (v ? new Date(v).toLocaleString('en-IN', { hour12: true, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

const Stat = ({ label, value, testId }) => (
  <Card><CardContent className="p-4">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-2xl font-bold" data-testid={testId}>{value}</p>
  </CardContent></Card>
);

const OrderRows = ({ orders }) => (
  <TableRow><TableCell colSpan={8} className="bg-gray-50 p-0">
    <Table>
      <TableHeader><TableRow>
        <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Slot</TableHead>
        <TableHead>Delivered At</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Pending</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {orders.map(o => (
          <TableRow key={o.id}>
            <TableCell>#{o.order_number}</TableCell>
            <TableCell>{o.customer_name}</TableCell>
            <TableCell>{o.delivery_date} {formatTime12(o.delivery_time)}</TableCell>
            <TableCell>{fmtDT(o.delivered_at)}</TableCell>
            <TableCell>
              {o.on_time === true && <Badge className="bg-green-600">On time</Badge>}
              {o.on_time === false && <Badge variant="destructive">Late</Badge>}
              {o.on_time === null && <Badge variant="outline">{o.status}</Badge>}
            </TableCell>
            <TableCell className="text-right">{inr(o.pending_amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableCell></TableRow>
);

export default function DeliveryReport() {
  const [filters, setFilters] = useState({ date_from: today(), date_to: today(), outlet_id: 'all' });
  const [outlets, setOutlets] = useState([]);
  const [data, setData] = useState({ persons: [], totals: {} });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});

  useEffect(() => {
    axios.get(`${API}/outlets`).then(r => setOutlets(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { ...filters };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    axios.get(`${API}/reports/delivery-persons`, { params })
      .then(r => setData(r.data))
      .catch(() => setData({ persons: [], totals: {} }))
      .finally(() => setLoading(false));
  }, [filters]);

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const t = data.totals || {};

  const exportExcel = () => exportRowsToExcel(data.persons, [
    { key: 'name', label: 'Delivery Person' }, { key: 'phone', label: 'Phone' },
    { key: 'assigned', label: 'Assigned' }, { key: 'delivered', label: 'Delivered' },
    { key: 'pending', label: 'Pending Deliveries' }, { key: 'on_time', label: 'On Time' },
    { key: 'late', label: 'Late' }, { key: 'cash_to_collect', label: 'Amount To Collect' },
  ], 'delivery_person_report', 'Delivery Report');

  return (
    <LayoutWithSidebar>
      <div className="p-6 space-y-6" data-testid="delivery-report-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6 text-[#e92587]" /> Delivery Person Report</h1>
          <Button variant="outline" onClick={exportExcel} data-testid="delivery-report-export-btn"><Download className="h-4 w-4 mr-2" />Export Excel</Button>
        </div>

        <Card><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div><Label>From</Label><Input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} data-testid="delivery-report-date-from" /></div>
          <div><Label>To</Label><Input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} data-testid="delivery-report-date-to" /></div>
          <div><Label>Outlet</Label>
            <Select value={filters.outlet_id} onValueChange={v => set('outlet_id', v)}>
              <SelectTrigger data-testid="delivery-report-outlet-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outlets</SelectItem>
                {outlets.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button variant="ghost" onClick={() => setFilters({ date_from: '', date_to: '', outlet_id: 'all' })} data-testid="delivery-report-clear-btn">All dates</Button></div>
        </CardContent></Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Assigned" value={t.assigned || 0} testId="delivery-total-assigned" />
          <Stat label="Delivered" value={t.delivered || 0} testId="delivery-total-delivered" />
          <Stat label="On time" value={t.on_time || 0} testId="delivery-total-ontime" />
          <Stat label="Late" value={t.late || 0} testId="delivery-total-late" />
          <Stat label="Amount to collect" value={inr(t.cash_to_collect)} testId="delivery-total-cash" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">By delivery person</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table data-testid="delivery-report-table">
                <TableHeader><TableRow>
                  <TableHead /><TableHead>Name</TableHead><TableHead>Assigned</TableHead><TableHead>Delivered</TableHead>
                  <TableHead>Pending</TableHead><TableHead>On time</TableHead><TableHead>Late</TableHead><TableHead className="text-right">To collect</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.persons.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">No deliveries in this period</TableCell></TableRow>}
                  {data.persons.map(p => (
                    <Fragment key={p.delivery_person_id}>
                      <TableRow className="cursor-pointer" onClick={() => setOpen(o => ({ ...o, [p.delivery_person_id]: !o[p.delivery_person_id] }))} data-testid={`delivery-row-${p.delivery_person_id}`}>
                        <TableCell>{open[p.delivery_person_id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-gray-500">{p.phone}</div></TableCell>
                        <TableCell>{p.assigned}</TableCell><TableCell>{p.delivered}</TableCell><TableCell>{p.pending}</TableCell>
                        <TableCell className="text-green-700">{p.on_time}</TableCell><TableCell className="text-red-600">{p.late}</TableCell>
                        <TableCell className="text-right">{inr(p.cash_to_collect)}</TableCell>
                      </TableRow>
                      {open[p.delivery_person_id] && <OrderRows orders={p.orders} />}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  );
}
