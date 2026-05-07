import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Save, AlertCircle, CheckCircle, Clock, Package, Truck, Star } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EVENT_CONFIG = {
  order_placed: {
    label: 'Order Placed',
    icon: Package,
    color: 'bg-blue-500',
    description: 'Sent when a new order is created'
  },
  order_confirmed: {
    label: 'Order Confirmed',
    icon: CheckCircle,
    color: 'bg-green-500',
    description: 'Sent when order status is updated to Confirmed'
  },
  order_ready: {
    label: 'Order Ready',
    icon: Clock,
    color: 'bg-orange-500',
    description: 'Sent when order is ready for pickup/delivery'
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    icon: Truck,
    color: 'bg-purple-500',
    description: 'Sent when order is picked up by delivery partner'
  },
  delivered: {
    label: 'Delivered',
    icon: Star,
    color: 'bg-pink-500',
    description: 'Sent when order is successfully delivered'
  }
};

const WhatsAppTemplates = () => {
  const { token } = useAuth();
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/whatsapp/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const templatesMap = {};
      response.data.forEach(template => {
        templatesMap[template.event_type] = template;
      });

      setTemplates(templatesMap);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setMessage({ type: 'error', text: 'Failed to load WhatsApp templates' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (eventType) => {
    try {
      setSaving(true);
      const template = templates[eventType] || {
        event_type: eventType,
        campaign_name: '',
        template_message: '',
        is_enabled: false
      };

      await axios.post(
        `${API_URL}/api/whatsapp/templates`,
        template,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: `${EVENT_CONFIG[eventType].label} template saved successfully!` });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      setMessage({ type: 'error', text: 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (eventType, field, value) => {
    setTemplates(prev => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        event_type: eventType,
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <LayoutWithSidebar>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg">Loading templates...</div>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <MessageSquare className="h-8 w-8" style={{ color: '#e92587' }} />
            <h1 className="text-3xl font-bold">WhatsApp Notifications</h1>
          </div>
          <p className="text-gray-600">
            Configure WhatsApp message templates for automated customer notifications at different order stages.
          </p>
        </div>

        {message.text && (
          <Alert className={`mb-6 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
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

        <div className="grid gap-6">
          {Object.entries(EVENT_CONFIG).map(([eventType, config]) => {
            const template = templates[eventType] || {
              event_type: eventType,
              campaign_name: '',
              template_message: '',
              is_enabled: false
            };

            const Icon = config.icon;

            return (
              <Card key={eventType} className="overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${config.color} bg-opacity-10`}>
                        <Icon className="h-5 w-5" style={{ color: '#e92587' }} />
                      </div>
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <span>{config.label}</span>
                          {template.is_enabled && (
                            <Badge className="bg-green-500 text-white">Active</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`enable-${eventType}`} className="text-sm font-medium">
                        Enable
                      </Label>
                      <Switch
                        id={`enable-${eventType}`}
                        checked={template.is_enabled}
                        onCheckedChange={(checked) => updateTemplate(eventType, 'is_enabled', checked)}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor={`campaign-${eventType}`}>
                        AiSensy Campaign Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`campaign-${eventType}`}
                        value={template.campaign_name || ''}
                        onChange={(e) => updateTemplate(eventType, 'campaign_name', e.target.value)}
                        placeholder="e.g., order_confirmed_template"
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The pre-approved campaign name in your AiSensy account
                      </p>
                    </div>

                    <div>
                      <Label htmlFor={`message-${eventType}`}>
                        Message Template <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id={`message-${eventType}`}
                        value={template.template_message || ''}
                        onChange={(e) => updateTemplate(eventType, 'template_message', e.target.value)}
                        placeholder="Hi {{1}}, your order {{2}} will be delivered on {{3}} at {{4}}"
                        rows={4}
                        className="mt-1 font-mono text-sm"
                      />
                      <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Available Parameters:</p>
                        <ul className="text-xs text-blue-800 space-y-1">
                          <li><code className="bg-blue-100 px-1 py-0.5 rounded">{'{{1}}'}</code> = Customer Name</li>
                          <li><code className="bg-blue-100 px-1 py-0.5 rounded">{'{{2}}'}</code> = Order Number</li>
                          <li><code className="bg-blue-100 px-1 py-0.5 rounded">{'{{3}}'}</code> = Delivery Date</li>
                          <li><code className="bg-blue-100 px-1 py-0.5 rounded">{'{{4}}'}</code> = Delivery Time</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleSaveTemplate(eventType)}
                        disabled={saving || !template.campaign_name || !template.template_message}
                        style={{ backgroundColor: '#e92587' }}
                        className="text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>📌 Important Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>All templates must be pre-approved by WhatsApp through your AiSensy account.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Campaign names must match exactly with those created in AiSensy.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Customer phone numbers must include country code (e.g., +91 for India).</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Templates are disabled by default. Enable them when ready to use.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Notifications are sent automatically when orders reach the configured status.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  );
};

export default WhatsAppTemplates;
