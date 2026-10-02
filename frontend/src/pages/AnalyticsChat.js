import { useState } from 'react';
import axios from 'axios';
import LayoutWithSidebar from '../components/LayoutWithSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Send } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AnalyticsChat = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setError('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/analytics/chat`, { question: q }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages((m) => [...m, { role: 'assistant', text: res.data.answer }]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'How many orders today across all outlets?',
    "What's my top flavour in the last 30 days?",
    'Which outlet made the most revenue in the last month?',
    'How much pending payment is there right now?',
    'Compare yesterday vs today revenue',
  ];

  return (
    <LayoutWithSidebar>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2" style={{ color: '#e92587' }}>
            <Sparkles className="h-7 w-7" /> Analytics Assistant
          </h2>
          <p className="text-gray-600 mt-1">
            Ask business questions in plain English. Powered by Claude Sonnet 4.6 with your live CRM data.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestions.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestion(s)}
                  className="text-xs"
                  data-testid={`analytics-suggestion-${suggestions.indexOf(s)}`}
                >
                  {s}
                </Button>
              ))}
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 mb-4"
                 data-testid="analytics-chat-history">
              {messages.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-6">
                  Start by picking a suggestion above or typing your own question.
                </div>
              )}
              {messages.map((m, idx) => (
                <div key={idx}
                     className={`rounded-lg p-3 text-sm whitespace-pre-wrap ${
                       m.role === 'user' ? 'bg-pink-50 border border-pink-200 ml-8'
                                          : 'bg-gray-50 border border-gray-200 mr-8'}`}
                     data-testid={`analytics-msg-${m.role}-${idx}`}>
                  <div className="text-xs uppercase font-semibold mb-1"
                       style={{ color: m.role === 'user' ? '#e92587' : '#6b7280' }}>
                    {m.role === 'user' ? 'You' : 'Assistant'}
                  </div>
                  <div>{m.text}</div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              )}
            </div>

            <div className="flex gap-2 items-end">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
                }}
                placeholder="e.g. Which outlet booked the most orders yesterday?"
                rows={2}
                data-testid="analytics-input"
              />
              <Button onClick={ask} disabled={loading || !question.trim()}
                      className="bg-pink-600 hover:bg-pink-700 text-white"
                      data-testid="analytics-send-btn">
                <Send className="h-4 w-4 mr-1" /> Ask
              </Button>
            </div>
            {error && (
              <div className="mt-2 text-sm text-red-600" data-testid="analytics-error">{error}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </LayoutWithSidebar>
  );
};

export default AnalyticsChat;
