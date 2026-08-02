import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatBirthday, ageFromBirthday } from '../utils/formatters';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOutlet, setFilterOutlet] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [sortBy, setSortBy] = useState('none'); // none | pending_desc | pending_asc | spent_desc | spent_asc | name
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const fetchCustomers = async () => {
    try {
      const url = filterOutlet === 'all' ? `${API}/customers` : `${API}/customers?outlet_id=${filterOutlet}`;
      const response = await axios.get(url);
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const response = await axios.get(`${API}/outlets`);
      setOutlets(response.data);
    } catch (error) {
      console.error('Failed to fetch outlets:', error);
    }
  };

  useEffect(() => { fetchOutlets(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchCustomers(); /* eslint-disable-next-line */ }, [filterOutlet]);

  const exportToExcel = () => {
    if (!customers.length) {
      alert('No customers to export');
      return;
    }
    const rows = customers.map((c) => ({
      Name: c.name || '',
      Phone: c.phone || '',
      Email: c.email || '',
      Birthday: formatBirthday(c.birthday),
      Age: ageFromBirthday(c.birthday) ?? '',
      Gender: c.gender || '',
      'Total Orders': c.total_orders || 0,
      'Total Spent': c.total_spent || 0,
      'Pending Amount': c.pending_amount || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { name: 'Sample Customer', phone: '9876543210', email: 'sample@x.com', birthday: '1990-01-15', gender: 'male', address: 'Sample Address', outlet_id: '' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'customer_import_template.xlsx');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const res = await axios.post(`${API}/customers/import`, { rows });
      setImportMsg(`Imported: ${res.data.inserted} new, ${res.data.updated} updated.`);
      fetchCustomers();
    } catch (err) {
      setImportMsg(err.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <LayoutWithSidebar>
        <div className="text-center py-12">Loading...</div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold" style={{ color: '#e92587' }}>Customers</h2>
            <p className="text-gray-600 mt-1">All customers from all outlets</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate} data-testid="customer-template-btn">
              <Download className="h-4 w-4 mr-2" /> Template
            </Button>
            <Button variant="outline" onClick={exportToExcel} data-testid="customer-export-btn">
              <Download className="h-4 w-4 mr-2" /> Export Excel
            </Button>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="bg-pink-600 text-white hover:bg-pink-700"
              data-testid="customer-import-btn"
            >
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Import Excel
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>

        {importMsg && (
          <div className="rounded border border-pink-200 bg-pink-50 px-3 py-2 text-sm text-pink-900" data-testid="customer-import-msg">
            {importMsg}
          </div>
        )}

        {/* Filters + Sort */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
              <div>
                <Label>Outlet</Label>
                <Select value={filterOutlet} onValueChange={setFilterOutlet}>
                  <SelectTrigger className="mt-1" data-testid="customer-outlet-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outlets</SelectItem>
                    {outlets.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>{outlet.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={filterGender} onValueChange={setFilterGender}>
                  <SelectTrigger className="mt-1" data-testid="customer-gender-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="unspecified">Unspecified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Age Min</Label>
                <Input
                  type="number"
                  min="0"
                  max="150"
                  value={filterAgeMin}
                  onChange={(e) => setFilterAgeMin(e.target.value)}
                  placeholder="e.g. 18"
                  className="mt-1"
                  data-testid="customer-age-min"
                />
              </div>
              <div>
                <Label>Age Max</Label>
                <Input
                  type="number"
                  min="0"
                  max="150"
                  value={filterAgeMax}
                  onChange={(e) => setFilterAgeMax(e.target.value)}
                  placeholder="e.g. 40"
                  className="mt-1"
                  data-testid="customer-age-max"
                />
              </div>
              <div>
                <Label>Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="mt-1" data-testid="customer-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Default</SelectItem>
                    <SelectItem value="pending_desc">Pending Payment: High → Low</SelectItem>
                    <SelectItem value="pending_asc">Pending Payment: Low → High</SelectItem>
                    <SelectItem value="spent_desc">Total Spent: High → Low</SelectItem>
                    <SelectItem value="spent_asc">Total Spent: Low → High</SelectItem>
                    <SelectItem value="name">Name (A → Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        {(() => {
          const minAge = filterAgeMin === '' ? null : Number(filterAgeMin);
          const maxAge = filterAgeMax === '' ? null : Number(filterAgeMax);
          let list = customers.filter((c) => {
            if (filterGender !== 'all') {
              const g = (c.gender || '').toLowerCase();
              if (filterGender === 'unspecified') { if (g) return false; }
              else if (g !== filterGender) return false;
            }
            if (minAge !== null || maxAge !== null) {
              const age = ageFromBirthday(c.birthday);
              if (age === null) return false;
              if (minAge !== null && age < minAge) return false;
              if (maxAge !== null && age > maxAge) return false;
            }
            return true;
          });
          const cmpNum = (a, b) => (a || 0) - (b || 0);
          if (sortBy === 'pending_desc') list = [...list].sort((a, b) => cmpNum(b.pending_amount, a.pending_amount));
          else if (sortBy === 'pending_asc') list = [...list].sort((a, b) => cmpNum(a.pending_amount, b.pending_amount));
          else if (sortBy === 'spent_desc') list = [...list].sort((a, b) => cmpNum(b.total_spent, a.total_spent));
          else if (sortBy === 'spent_asc') list = [...list].sort((a, b) => cmpNum(a.total_spent, b.total_spent));
          else if (sortBy === 'name') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

          return (
        <Card>
          <CardHeader>
            <CardTitle>All Customers ({list.length}{list.length !== customers.length ? ` / ${customers.length}` : ''})</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No customers found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Birthday</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((customer, index) => (
                    <TableRow key={index} data-testid={`customer-row-${customer.phone || index}`}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{formatBirthday(customer.birthday)}</TableCell>
                      <TableCell>{ageFromBirthday(customer.birthday) ?? '-'}</TableCell>
                      <TableCell>
                        {customer.gender ? (
                          <Badge variant="outline" className="capitalize">{customer.gender}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: '#e92587', color: 'white' }}>
                          {customer.total_orders}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold" style={{ color: '#10b981' }}>
                          ₹{customer.total_spent?.toFixed(2) || '0.00'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold" style={{ color: '#f59e0b' }}>
                          ₹{customer.pending_amount?.toFixed(2) || '0.00'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          );
        })()}
      </div>
    </LayoutWithSidebar>
  );
};

export default Customers;
