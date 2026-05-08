import { useState, useEffect } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, Download, RefreshCw, User, ShoppingCart, Settings as SettingsIcon, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ActivityLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    user_id: '',
    action_type: '',
    outlet_id: '',
    search: ''
  });

  useEffect(() => {
    fetchLogs();
    fetchUsers();
    fetchOutlets();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/activity-logs`);
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
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

  const applyFilters = () => {
    let filtered = [...logs];

    // Date range filter
    if (filters.date_from) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) >= new Date(filters.date_from)
      );
    }
    if (filters.date_to) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) <= new Date(filters.date_to + 'T23:59:59')
      );
    }

    // User filter
    if (filters.user_id) {
      filtered = filtered.filter(log => log.user_id === filters.user_id);
    }

    // Action type filter
    if (filters.action_type) {
      filtered = filtered.filter(log => log.action_type === filters.action_type);
    }

    // Outlet filter
    if (filters.outlet_id) {
      filtered = filtered.filter(log => log.outlet_id === filters.outlet_id);
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.description?.toLowerCase().includes(searchLower) ||
        log.user_name?.toLowerCase().includes(searchLower) ||
        log.order_number?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLogs(filtered);
  };

  const getActionIcon = (actionType) => {
    const icons = {
      'order_created': <ShoppingCart className="h-4 w-4 text-green-600" />,
      'order_updated': <ShoppingCart className="h-4 w-4 text-blue-600" />,
      'order_deleted': <ShoppingCart className="h-4 w-4 text-red-600" />,
      'payment_recorded': <Clock className="h-4 w-4 text-green-600" />,
      'status_changed': <RefreshCw className="h-4 w-4 text-orange-600" />,
      'user_created': <User className="h-4 w-4 text-blue-600" />,
      'user_updated': <User className="h-4 w-4 text-blue-600" />,
      'settings_updated': <SettingsIcon className="h-4 w-4 text-purple-600" />,
      'login': <User className="h-4 w-4 text-green-600" />,
      'logout': <User className="h-4 w-4 text-gray-600" />
    };
    return icons[actionType] || <Clock className="h-4 w-4 text-gray-600" />;
  };

  const getActionBadge = (actionType) => {
    const variants = {
      'order_created': 'default',
      'order_updated': 'secondary',
      'order_deleted': 'destructive',
      'payment_recorded': 'default',
      'status_changed': 'secondary',
      'user_created': 'default',
      'user_updated': 'secondary',
      'settings_updated': 'secondary',
      'login': 'default',
      'logout': 'secondary'
    };
    
    return (
      <Badge variant={variants[actionType] || 'secondary'}>
        {actionType?.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const clearFilters = () => {
    setFilters({
      date_from: '',
      date_to: '',
      user_id: '',
      action_type: '',
      outlet_id: '',
      search: ''
    });
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Description', 'Outlet', 'IP Address'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.user_name || 'System',
        log.action_type,
        log.description?.replace(/,/g, ';') || '',
        log.outlet_name || '',
        log.ip_address || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <LayoutWithSidebar>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Activity Logs</h1>
            <p className="text-gray-500">Track all activities in the CRM</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchLogs} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportLogs} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Date From</Label>
                <Input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({...filters, date_from: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Date To</Label>
                <Input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({...filters, date_to: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>User</Label>
                <Select value={filters.user_id} onValueChange={(value) => setFilters({...filters, user_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Users</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select value={filters.action_type} onValueChange={(value) => setFilters({...filters, action_type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Actions</SelectItem>
                    <SelectItem value="order_created">Order Created</SelectItem>
                    <SelectItem value="order_updated">Order Updated</SelectItem>
                    <SelectItem value="order_deleted">Order Deleted</SelectItem>
                    <SelectItem value="payment_recorded">Payment Recorded</SelectItem>
                    <SelectItem value="status_changed">Status Changed</SelectItem>
                    <SelectItem value="user_created">User Created</SelectItem>
                    <SelectItem value="user_updated">User Updated</SelectItem>
                    <SelectItem value="settings_updated">Settings Updated</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Outlet</Label>
                <Select value={filters.outlet_id} onValueChange={(value) => setFilters({...filters, outlet_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Outlets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Outlets</SelectItem>
                    {outlets.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search description, user, order..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={clearFilters} variant="outline" className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Activity Log ({filteredLogs.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading logs...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No logs found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action_type)}
                            {getActionBadge(log.action_type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {log.user_name || 'System'}
                            <span className="text-xs text-gray-500">({log.user_role})</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={log.description}>
                            {log.description}
                          </div>
                        </TableCell>
                        <TableCell>{log.outlet_name || '-'}</TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {log.ip_address || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  );
};

export default ActivityLogs;
