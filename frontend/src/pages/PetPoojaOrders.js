import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  Truck, 
  Star, 
  XCircle,
  AlertCircle,
  Eye,
  Copy,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PETPOOJA_STATUS_MAP = {
  '-1': { label: 'Cancelled', color: 'bg-red-500', icon: XCircle },
  '1': { label: 'Accepted', color: 'bg-green-500', icon: CheckCircle },
  '2': { label: 'Accepted', color: 'bg-green-500', icon: CheckCircle },
  '3': { label: 'Accepted', color: 'bg-green-500', icon: CheckCircle },
  '4': { label: 'Dispatched', color: 'bg-purple-500', icon: Truck },
  '5': { label: 'Food Ready', color: 'bg-orange-500', icon: Clock },
  '10': { label: 'Delivered', color: 'bg-green-600', icon: Star }
};

const PetPoojaOrders = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showWebhookInfo, setShowWebhookInfo] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchWebhookUrl();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/petpooja/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching PetPooja orders:', error);
      setMessage({ type: 'error', text: 'Failed to fetch PetPooja orders' });
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhookUrl = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/petpooja/webhook-url`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWebhookUrl(response.data.webhook_url);
    } catch (error) {
      console.error('Error fetching webhook URL:', error);
    }
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setMessage({ type: 'success', text: 'Webhook URL copied to clipboard!' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const getStatusBadge = (petpoojaStatus) => {
    const statusStr = petpoojaStatus?.toString();
    const config = PETPOOJA_STATUS_MAP[statusStr];
    
    if (!config) return <Badge>Unknown</Badge>;
    
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <LayoutWithSidebar>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg">Loading PetPooja orders...</div>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Package className="h-8 w-8" style={{ color: '#e92587' }} />
              <h1 className="text-3xl font-bold">PetPooja Orders</h1>
            </div>
            <p className="text-gray-600">
              Orders received from PetPooja POS system
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowWebhookInfo(!showWebhookInfo)}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Webhook Info
            </Button>
            <Button
              onClick={fetchOrders}
              style={{ backgroundColor: '#e92587' }}
              className="text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Webhook Info Card */}
        {showWebhookInfo && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">📡 PetPooja Callback URL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-blue-900 font-semibold">Callback URL to provide PetPooja team:</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <code className="flex-1 p-3 bg-white rounded border border-blue-200 text-sm font-mono">
                      {webhookUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyWebhookUrl}
                      title="Copy URL"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-white rounded border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Instructions:</p>
                  <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                    <li>Copy the callback URL above</li>
                    <li>Provide it to PetPooja team/support</li>
                    <li>They will configure it in your PetPooja account</li>
                    <li>PetPooja will send order updates to this URL automatically</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {message.text && (
          <Alert className={`${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Orders from PetPooja POS ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">No PetPooja orders yet</p>
                <p className="text-sm text-gray-500">
                  Orders from PetPooja POS will appear here automatically
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>PetPooja Status</TableHead>
                      <TableHead>Rider Info</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.order_number}
                          {order.petpooja_rest_id && (
                            <div className="text-xs text-gray-500">
                              Rest ID: {order.petpooja_rest_id}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customer_info?.name}</div>
                            <div className="text-sm text-gray-500">{order.customer_info?.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.outlet_id || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{order.flavour} - {order.size_pounds} lbs</div>
                            <div className="text-gray-500">{order.delivery_date}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.petpooja_status)}
                        </TableCell>
                        <TableCell>
                          {order.rider_name ? (
                            <div className="text-sm">
                              <div className="font-medium">{order.rider_name}</div>
                              <div className="text-gray-500">{order.rider_phone}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.is_modified ? (
                            <Badge className="bg-orange-500 text-white">Modified</Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(order.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewOrder(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>PetPooja Order Details - {selectedOrder?.order_number}</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Order Number</Label>
                    <div className="font-medium mt-1">{selectedOrder.order_number}</div>
                  </div>
                  <div>
                    <Label>PetPooja Restaurant ID</Label>
                    <div className="font-medium mt-1">{selectedOrder.petpooja_rest_id || 'N/A'}</div>
                  </div>
                  <div>
                    <Label>Customer Name</Label>
                    <div className="font-medium mt-1">{selectedOrder.customer_info?.name}</div>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <div className="font-medium mt-1">{selectedOrder.customer_info?.phone}</div>
                  </div>
                  <div>
                    <Label>Flavour</Label>
                    <div className="font-medium mt-1">{selectedOrder.flavour}</div>
                  </div>
                  <div>
                    <Label>Size</Label>
                    <div className="font-medium mt-1">{selectedOrder.size_pounds} lbs</div>
                  </div>
                  <div>
                    <Label>Delivery Date</Label>
                    <div className="font-medium mt-1">{selectedOrder.delivery_date}</div>
                  </div>
                  <div>
                    <Label>Delivery Time</Label>
                    <div className="font-medium mt-1">{selectedOrder.delivery_time}</div>
                  </div>
                  <div>
                    <Label>PetPooja Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedOrder.petpooja_status)}</div>
                  </div>
                  <div>
                    <Label>Our System Status</Label>
                    <div className="mt-1">
                      <Badge variant="outline">{selectedOrder.status}</Badge>
                    </div>
                  </div>
                </div>

                {(selectedOrder.rider_name || selectedOrder.rider_phone) && (
                  <div className="border-t pt-4">
                    <Label>Rider Information</Label>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      {selectedOrder.rider_name && (
                        <div>
                          <div className="text-sm text-gray-600">Name</div>
                          <div className="font-medium">{selectedOrder.rider_name}</div>
                        </div>
                      )}
                      {selectedOrder.rider_phone && (
                        <div>
                          <div className="text-sm text-gray-600">Phone</div>
                          <div className="font-medium">{selectedOrder.rider_phone}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedOrder.is_modified && (
                  <div className="p-3 bg-orange-50 rounded border border-orange-200">
                    <p className="text-sm font-semibold text-orange-900">
                      ⚠️ This order was modified by the restaurant in PetPooja
                    </p>
                  </div>
                )}

                {selectedOrder.special_instructions && (
                  <div className="border-t pt-4">
                    <Label>Special Instructions</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded border whitespace-pre-line">
                      {selectedOrder.special_instructions}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <Label>Payment Information</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <span className="font-bold">₹{selectedOrder.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid Amount:</span>
                      <span className="font-bold text-green-600">₹{selectedOrder.paid_amount.toFixed(2)}</span>
                    </div>
                    {selectedOrder.pending_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Pending Amount:</span>
                        <span className="font-bold text-orange-600">₹{selectedOrder.pending_amount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </LayoutWithSidebar>
  );
};

export default PetPoojaOrders;
