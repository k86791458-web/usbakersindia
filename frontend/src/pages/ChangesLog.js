import { useEffect, useState } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Trash2, Sparkles, Wrench, Bug } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categoryMeta = {
  feature: { label: 'Feature', icon: Sparkles, cls: 'bg-pink-100 text-pink-700 border-pink-300' },
  improvement: { label: 'Improvement', icon: Wrench, cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  bugfix: { label: 'Bug Fix', icon: Bug, cls: 'bg-amber-100 text-amber-700 border-amber-300' },
};

const ChangesLog = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'feature' });

  const token = localStorage.getItem('token');

  const load = async () => {
    try {
      const res = await axios.get(`${API}/change-log`, { headers: { Authorization: `Bearer ${token}` } });
      setEntries(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/change-log`, form, { headers: { Authorization: `Bearer ${token}` } });
      setOpen(false);
      setForm({ title: '', description: '', category: 'feature' });
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await axios.delete(`${API}/change-log/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      load();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <LayoutWithSidebar>
      <div className="space-y-6" data-testid="changes-log-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#e92587' }}>Changes Log</h1>
            <p className="text-gray-600 mt-1">All features, improvements and bug fixes made to the app</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: '#e92587' }} className="text-white" data-testid="add-change-log-btn">
                <Plus className="h-4 w-4 mr-2" /> Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Change Log Entry</DialogTitle>
                <DialogDescription>Record a new change made to the system.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="change-log-title-input" />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={4} data-testid="change-log-desc-input" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger data-testid="change-log-category-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="improvement">Improvement</SelectItem>
                      <SelectItem value="bugfix">Bug Fix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" style={{ backgroundColor: '#e92587' }} data-testid="submit-change-log">Save Entry</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> {entries.length} Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 py-6 text-center">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="text-gray-500 py-6 text-center">No changes logged yet</p>
            ) : (
              <ol className="relative border-l border-pink-200 ml-3 space-y-5">
                {entries.map((e) => {
                  const meta = categoryMeta[e.category] || categoryMeta.feature;
                  const Icon = meta.icon;
                  const d = new Date(e.created_at);
                  return (
                    <li key={e.id} className="ml-6" data-testid={`change-log-item-${e.id}`}>
                      <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 ring-4 ring-white">
                        <Icon className="h-3 w-3 text-pink-600" />
                      </span>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900">{e.title}</h3>
                            <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{e.description}</p>
                          <p className="text-xs text-gray-400 mt-1">{d.toLocaleDateString()} • {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => remove(e.id)} className="text-red-500 hover:text-red-700" data-testid={`delete-change-log-${e.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  );
};

export default ChangesLog;
