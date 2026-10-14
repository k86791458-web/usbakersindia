import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MonitorSmartphone, Trash2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (v) => (v ? new Date(v).toLocaleString('en-IN', { hour12: true, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

export const TrustedDevicesCard = () => {
  const [devices, setDevices] = useState([]);

  const load = () => axios.get(`${API}/auth/trusted-devices`, { params: { all_users: true } })
    .then(r => setDevices(r.data || [])).catch(() => setDevices([]));

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    await axios.delete(`${API}/auth/trusted-devices/${id}`);
    load();
  };

  return (
    <Card data-testid="trusted-devices-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5" style={{ color: '#e92587' }} />
          Trusted Devices
        </CardTitle>
        <p className="text-sm text-gray-600">Devices that skip the 2FA code for 30 days. Remove a device to ask for the code again.</p>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4" data-testid="trusted-devices-empty">No trusted devices</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Device</TableHead><TableHead>Last used</TableHead>
              <TableHead>Expires</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {devices.map(d => (
                <TableRow key={d.id} data-testid={`trusted-device-row-${d.id}`}>
                  <TableCell><div className="font-medium">{d.user_name}</div><div className="text-xs text-gray-500">{d.user_email}</div></TableCell>
                  <TableCell>{d.device_name}</TableCell>
                  <TableCell>{fmt(d.last_used_at)}</TableCell>
                  <TableCell>{fmt(d.expires_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => remove(d.id)} data-testid={`trusted-device-remove-${d.id}`}>
                      <Trash2 className="h-3 w-3 mr-1" />Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
