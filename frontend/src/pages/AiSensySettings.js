import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Save, AlertCircle, CheckCircle, Settings2,
  Package, Clock, Truck, Star
} from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PARAM_KEYS = [
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'order_number', label: 'Order Number' },
  { key: 'delivery_date', label: 'Delivery Date' },
  { key: 'delivery_time', label: 'Delivery Time' },
  { key: 'total_amount', label: 'Total Amount' },
  { key: 'pending_amount', label: 'Pending Amount' },
  { key: 'paid_amount', label: 'Paid Amount' },
  { key: 'outlet_name', label: 'Outlet Name' },
  { key: 'flavour', label: 'Flavour' },
  { key: 'occasion', label: 'Occasion' },
];

const EVENT_CONFIG = {
  order_placed: {
    label: 'Order Placed',
    icon: Package,
    description: 'Sent when a new order is created (Hold or Punch)'
  },
  order_confirmed: {
    label: 'Order Confirmed',
    icon: CheckCircle,
    description: 'Sent when payment threshold is met & order becomes active'
  },
  order_ready: {
    label: 'Order Ready',
    icon: Clock,
    description: 'Sent when kitchen marks the order ready'
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    icon: Truck,
    description: 'Sent when delivery person picks up the order'
  },
  delivered: {
    label: 'Delivered',
    icon: Star,
    description: 'Sent when the order is delivered to the customer'
  }
};

const DEFAULT_PARAMS = ['customer_name', 'order_number', 'delivery_date', 'delivery_time'];

const AiSensySettings = () => {
  const { token } = useAuth();
  const [config, setConfig] = useState({
    api_key: '',
    api_key_masked: '',
    default_source: 'crm',
    default_user_name: 'US Bakers',
    configured: false
  });
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('config');

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    Promise.all([fetchConfig(), fetchTemplates()]).finally(() => setLoading(false));
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/aisensy/config`, authHeaders);
      setConfig({ ...res.data, api_key: '' });
    } catch (e) { /* ignore */ }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/aisensy/templates`, authHeaders);
      const map = {};
      (res.data || []).forEach(t => { map[t.event_type] = t; });
      setTemplates(map);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to load templates' });
    }
  };

  const handleSaveConfig = async () => {
    if (!config.api_key && !config.configured) {
      setMessage({ type: 'error', text: 'API Key is required' });
      return;
    }
    try {
      setSaving(true);
      // If user left api_key blank but a key is already configured, do not overwrite.
      const payload = {
        default_source: config.default_source || 'crm',
        default_user_name: config.default_user_name || 'US Bakers',
      };
      if (config.api_key) payload.api_key = config.api_key;
      else if (config.configured) payload.api_key = '__keep__'; // sentinel handled below

      // If we have configured key and user didn't enter a new one, skip API call for api_key change
      if (!config.api_key && config.configured) {
        // We still want to update source/user_name — but the backend endpoint requires api_key.
        // Fetch existing, then send the *masked* full payload back. Backend stores plaintext only on real save.
        // For now: only allow update with new api_key entry.
        setMessage({ type: 'error', text: 'Paste your API Key again to update settings (we never store it in the browser).' });
        setSaving(false);
        return;
      }

      await axios.post(`${API_URL}/api/aisensy/config`, {
        api_key: config.api_key,
        default_source: config.default_source || 'crm',
        default_user_name: config.default_user_name || 'US Bakers',
      }, authHeaders);

      setMessage({ type: 'success', text: 'AiSensy configuration saved!' });
      setConfig(c => ({ ...c, api_key: '' }));
      fetchConfig();
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (eventType) => {
    const t = templates[eventType] || {
      event_type: eventType, campaign_name: '',
      template_params: DEFAULT_PARAMS, tags: [], is_enabled: false
    };
    if (!t.campaign_name) {
      setMessage({ type: 'error', text: 'Campaign Name is required' });
      return;
    }
    try {
      setSaving(true);
      await axios.post(`${API_URL}/api/aisensy/templates`, {
        event_type: eventType,
        campaign_name: t.campaign_name,
        template_params: t.template_params && t.template_params.length ? t.template_params : DEFAULT_PARAMS,
        tags: t.tags || [],
        is_enabled: !!t.is_enabled,
      }, authHeaders);
      setMessage({ type: 'success', text: `${EVENT_CONFIG[eventType].label} template saved!` });
      fetchTemplates();
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  const updateTemplateField = (eventType, field, value) => {
    setTemplates(prev => ({
      ...prev,
      [eventType]: {
        ...(prev[eventType] || { event_type: eventType, template_params: DEFAULT_PARAMS, tags: [], is_enabled: false, campaign_name: '' }),
        [field]: value,
      }
    }));
  };

  const updateParamAt = (eventType, idx, key) => {
    const current = templates[eventType]?.template_params || [...DEFAULT_PARAMS];
    const next = [...current];
    next[idx] = key;
    updateTemplateField(eventType, 'template_params', next);
  };

  const addParam = (eventType) => {
    const current = templates[eventType]?.template_params || [...DEFAULT_PARAMS];
    updateTemplateField(eventType, 'template_params', [...current, 'customer_name']);
  };

  const removeParam = (eventType, idx) => {
    const current = templates[eventType]?.template_params || [...DEFAULT_PARAMS];
    const next = current.filter((_, i) => i !== idx);
    updateTemplateField(eventType, 'template_params', next.length ? next : DEFAULT_PARAMS);
  };

  if (loading) {
    return (
      <LayoutWithSidebar>
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg">Loading AiSensy settings...</div>
        </div>
      </LayoutWithSidebar>
    );
  }

  return (
    <LayoutWithSidebar>
      <div className="p-8" data-testid="aisensy-settings-page">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <MessageSquare className="h-8 w-8" style={{ color: '#e92587' }} />
            <h1 className="text-3xl font-bold">AiSensy WhatsApp Settings</h1>
          </div>
          <p className="text-gray-600">
            Configure AiSensy WhatsApp Business API for automated customer notifications.
            Endpoint used: <code className="bg-gray-100 px-1 rounded text-xs">POST https://backend.aisensy.com/campaign/t1/api/v2</code>
          </p>
        </div>

        {message.text && (
          <Alert className={`mb-6 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {message.type === 'success'
              ? <CheckCircle className="h-4 w-4 text-green-600" />
              : <AlertCircle className="h-4 w-4 text-red-600" />}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="config" data-testid="tab-config">
              <Settings2 className="h-4 w-4 mr-2" /> API Configuration
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <MessageSquare className="h-4 w-4 mr-2" /> Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>AiSensy API Credentials</CardTitle>
                <CardDescription>
                  Your AiSensy API key (JWT token from the AiSensy dashboard).
                  {config.configured && <span className="ml-2 text-green-600 font-medium">Currently configured: {config.api_key_masked}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="api_key">
                    API Key <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={config.api_key || ''}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    placeholder={config.configured ? 'Paste again to replace existing key' : 'Paste your AiSensy JWT API key'}
                    className="mt-1 font-mono"
                    data-testid="aisensy-api-key-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get this from <span className="font-mono">AiSensy → Manage → API Key</span>. The key never leaves your server.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="default_source">Default Source</Label>
                    <Input
                      id="default_source"
                      value={config.default_source || ''}
                      onChange={(e) => setConfig({ ...config, default_source: e.target.value })}
                      placeholder="crm"
                      className="mt-1"
                      data-testid="aisensy-source-input"
                    />
                    <p className="text-xs text-gray-500 mt-1">Source label sent to AiSensy for tracking.</p>
                  </div>
                  <div>
                    <Label htmlFor="default_user_name">Default User Name</Label>
                    <Input
                      id="default_user_name"
                      value={config.default_user_name || ''}
                      onChange={(e) => setConfig({ ...config, default_user_name: e.target.value })}
                      placeholder="US Bakers"
                      className="mt-1"
                      data-testid="aisensy-username-input"
                    />
                    <p className="text-xs text-gray-500 mt-1">Sender name shown on AiSensy contact records.</p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleSaveConfig}
                    disabled={saving || !config.api_key}
                    style={{ backgroundColor: '#e92587' }}
                    className="text-white"
                    data-testid="save-aisensy-config-btn"
                  >
                    <Save className="h-4 w-4 mr-2" /> Save Configuration
                  </Button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-2">How AiSensy works here</p>
                  <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                    <li>Phone numbers are auto-normalised to <code>+91XXXXXXXXXX</code> for Indian numbers.</li>
                    <li>Each order event (placed, confirmed, ready, out for delivery, delivered) maps to one AiSensy <strong>campaign</strong>.</li>
                    <li>You must create &amp; approve those campaigns in your AiSensy dashboard and put their exact names in the Campaigns tab.</li>
                    <li>Variable order in your WhatsApp template must match the parameter list configured per campaign.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <div className="space-y-6">
              {Object.entries(EVENT_CONFIG).map(([eventType, cfg]) => {
                const t = templates[eventType] || {
                  event_type: eventType, campaign_name: '',
                  template_params: DEFAULT_PARAMS, tags: [], is_enabled: false
                };
                const Icon = cfg.icon;
                return (
                  <Card key={eventType}>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-pink-50">
                            <Icon className="h-5 w-5" style={{ color: '#e92587' }} />
                          </div>
                          <div>
                            <CardTitle className="flex items-center space-x-2">
                              <span>{cfg.label}</span>
                              {t.is_enabled && <Badge className="bg-green-500 text-white">Active</Badge>}
                            </CardTitle>
                            <CardDescription>{cfg.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label htmlFor={`enable-${eventType}`} className="text-sm font-medium">Enable</Label>
                          <Switch
                            id={`enable-${eventType}`}
                            checked={!!t.is_enabled}
                            onCheckedChange={(v) => updateTemplateField(eventType, 'is_enabled', v)}
                            data-testid={`enable-${eventType}-switch`}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`campaign-${eventType}`}>
                            Campaign Name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id={`campaign-${eventType}`}
                            value={t.campaign_name || ''}
                            onChange={(e) => updateTemplateField(eventType, 'campaign_name', e.target.value)}
                            placeholder="e.g. order_confirmed_v1"
                            className="mt-1"
                            data-testid={`campaign-${eventType}-input`}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Must match the AiSensy API campaign name exactly (campaign must be Live).
                          </p>
                        </div>

                        <div>
                          <Label>Template Parameters (in order)</Label>
                          <p className="text-xs text-gray-500 mb-2">
                            These values are sent as <code>templateParams</code>. Order must match the
                            placeholders in your AiSensy template (
                            <code>&#123;&#123;1&#125;&#125;</code>, <code>&#123;&#123;2&#125;&#125;</code>, ...).
                          </p>
                          <div className="space-y-2">
                            {(t.template_params && t.template_params.length ? t.template_params : DEFAULT_PARAMS).map((p, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs font-mono w-12 text-gray-500">{`{{${idx + 1}}}`}</span>
                                <select
                                  value={p}
                                  onChange={(e) => updateParamAt(eventType, idx, e.target.value)}
                                  className="border rounded-md px-3 py-2 text-sm flex-1 bg-white"
                                  data-testid={`param-${eventType}-${idx}-select`}
                                >
                                  {PARAM_KEYS.map(k => (
                                    <option key={k.key} value={k.key}>{k.label} ({k.key})</option>
                                  ))}
                                </select>
                                <Button
                                  type="button" variant="outline" size="sm"
                                  onClick={() => removeParam(eventType, idx)}
                                  className="text-red-600"
                                >Remove</Button>
                              </div>
                            ))}
                            <Button
                              type="button" variant="outline" size="sm"
                              onClick={() => addParam(eventType)}
                              data-testid={`add-param-${eventType}-btn`}
                            >+ Add Parameter</Button>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`tags-${eventType}`}>Tags (comma separated, optional)</Label>
                          <Input
                            id={`tags-${eventType}`}
                            value={(t.tags || []).join(', ')}
                            onChange={(e) => updateTemplateField(
                              eventType,
                              'tags',
                              e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            )}
                            placeholder="vip, repeat-customer"
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Only tags that already exist in your AiSensy project will be applied.
                          </p>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={() => handleSaveTemplate(eventType)}
                            disabled={saving || !t.campaign_name}
                            style={{ backgroundColor: '#e92587' }}
                            className="text-white"
                            data-testid={`save-${eventType}-btn`}
                          >
                            <Save className="h-4 w-4 mr-2" /> Save Campaign
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </LayoutWithSidebar>
  );
};

export default AiSensySettings;
