import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Package,
  IndianRupee,
  RefreshCw,
  Server,
  Sparkles,
  MapPin,
  Bot,
  Send,
  Trash2,
  RotateCcw,
  Activity,
  Check,
} from 'lucide-react';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  dataset: {
    loaded: boolean;
    filePath: string;
    totalOrders: number;
    totalRevenueInr: number;
  };
  aiConfig: {
    provider: string;
    model: string;
    keyConfigured: boolean;
  };
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenueInr: number;
  dateRange: {
    from: string;
    to: string;
  };
  uniqueCustomers: number;
  uniqueProducts: number;
  uniqueCategories: number;
  uniqueCities: number;
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  cityCounts: Record<string, number>;
}

export interface OrderItem {
  order_id: string;
  order_date: string;
  customer_name: string;
  city: string;
  product: string;
  category: string;
  quantity: number;
  unit_price_inr: number;
  total_inr: number;
  payment_method: string;
  status: string;
}

export interface ToolEvent {
  name: string;
  label: string;
  status: 'success' | 'error' | string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ToolEvent[];
  timestamp: string;
  isError?: boolean;
  canRetry?: boolean;
}

export const SUGGESTED_QUESTIONS = [
  'What is the status of order ORD-1025?',
  'How many orders were cancelled?',
  'What was the revenue from Electronics in August 2026?',
  'Which customer has spent the most?',
];

export default function App() {
  // System and Dataset State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chatLoading]);

  // Fetch system health and initial dataset summary
  const fetchHealthAndData = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const [healthRes, summaryRes, ordersRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/orders/summary'),
        fetch('/api/orders?limit=6'),
      ]);

      if (!healthRes.ok) {
        throw new Error(`Health check failed with HTTP ${healthRes.status}`);
      }

      const healthData = (await healthRes.json()) as HealthResponse;
      setHealth(healthData);

      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as OrderSummary;
        setSummary(summaryData);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.orders || []);
      }

      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      console.error('Failed to connect to API:', err);
      setHealthError(err instanceof Error ? err.message : 'Unknown network error');
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthAndData();
  }, []);

  // Send message to real POST /api/chat endpoint
  const handleSendMessage = async (textToSend?: string) => {
    const rawMessage = textToSend !== undefined ? textToSend : inputText;
    const message = rawMessage.trim();

    if (!message || chatLoading) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      role: 'user',
      content: message,
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMessage =
          data?.message || `Request failed with status ${res.status}`;
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          isError: true,
          canRetry: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setLastFailedMessage(message);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'No reply was returned by the assistant.',
        toolEvents: Array.isArray(data.toolEvents) ? data.toolEvents : [],
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLastFailedMessage(null);
    } catch (err: unknown) {
      const networkErrorMessage =
        err instanceof Error
          ? `Network error: ${err.message}`
          : 'Failed to communicate with the server. Please check your connection.';

      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: networkErrorMessage,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        isError: true,
        canRetry: true,
      };

      setMessages((prev) => [...prev, errorMsg]);
      setLastFailedMessage(message);
    } finally {
      setChatLoading(false);
      // Refocus input if on desktop
      if (window.innerWidth > 768) {
        textareaRef.current?.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setLastFailedMessage(null);
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      handleSendMessage(lastFailedMessage);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'cancelled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'returned':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'shipped':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'processing':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">Orderly AI</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  {health?.aiConfig?.model || 'gemini-3.8-flash'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Intelligent Order Assistant & Operations Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {health?.status === 'ok' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Backend & Dataset Online
              </span>
            ) : healthError ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5" />
                Backend Disconnected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                Connecting...
              </span>
            )}

            <button
              onClick={fetchHealthAndData}
              disabled={healthLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition disabled:opacity-50 cursor-pointer"
              title="Refresh status from /api/health"
              aria-label="Refresh system status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Split 2-column SaaS Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive AI Order Assistant (7 Columns) */}
        <section
          className="lg:col-span-7 flex flex-col h-[750px] rounded-2xl border border-slate-800/90 bg-slate-900/60 shadow-xl overflow-hidden"
          aria-label="Chat assistant panel"
        >
          {/* Chat Window Header */}
          <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Order Assistant</h2>
                <p className="text-[11px] text-slate-400">
                  Grounded with Gemini function calling on 60 verified orders
                </p>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                title="Clear current conversation"
                aria-label="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Chat</span>
              </button>
            )}
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.length === 0 ? (
              /* Welcome Screen & Suggested Questions */
              <div className="h-full flex flex-col justify-center items-center text-center px-4 py-6 max-w-lg mx-auto">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4 ring-1 ring-white/20">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Welcome to Orderly AI</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                  I am your intelligent order operations assistant. Ask me questions about order
                  status, catalog revenue, cancellations, or customer rankings across the supplied 60-order dataset.
                </p>

                <div className="w-full space-y-2">
                  <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 text-left px-1">
                    Suggested Questions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                    {SUGGESTED_QUESTIONS.map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(question)}
                        disabled={chatLoading}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-800/60 transition group text-xs text-slate-300 hover:text-white flex flex-col justify-between cursor-pointer"
                      >
                        <span className="font-medium group-hover:text-blue-400 transition mb-1">
                          {question}
                        </span>
                        <span className="text-[10px] text-slate-500">Click to ask</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Conversation Messages */
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : msg.isError
                        ? 'bg-rose-950/40 border border-rose-500/30 text-rose-200 rounded-bl-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {/* Tool Events Activity Badges */}
                    {msg.toolEvents && msg.toolEvents.length > 0 && (
                      <div className="mb-2.5 pb-2.5 border-b border-slate-800/80 flex flex-wrap gap-1.5">
                        {msg.toolEvents.map((evt, eIdx) => (
                          <span
                            key={eIdx}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border ${
                              evt.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                            title={`Tool: ${evt.name} (${evt.status})`}
                          >
                            {evt.status === 'success' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                            )}
                            <span>{evt.label}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Message Content */}
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Error Retry Button */}
                    {msg.isError && msg.canRetry && (
                      <div className="mt-3 pt-2 border-t border-rose-500/20 flex items-center justify-between">
                        <span className="text-[11px] text-rose-300">
                          Something went wrong.
                        </span>
                        <button
                          onClick={handleRetry}
                          disabled={chatLoading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              ))
            )}

            {/* Loading Indicator */}
            {chatLoading && (
              <div className="flex flex-col items-start space-y-1">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-xs px-4 py-3 text-xs sm:text-sm text-slate-300 flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"></div>
                  <span className="animate-pulse">
                    Orderly AI is processing your request via Gemini...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Controls */}
          <div className="p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-900/90">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about orders, revenue, cancellations, customers (Enter to send, Shift+Enter for new line)..."
                  rows={2}
                  maxLength={2000}
                  disabled={chatLoading}
                  aria-label="Ask Orderly AI about orders"
                  className="w-full resize-none rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 transition"
                />
              </div>

              <button
                type="submit"
                disabled={chatLoading || !inputText.trim()}
                aria-label="Send message"
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-600/20 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
              <span>Press <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-[10px]">Enter</kbd> to submit</span>
              <span>{inputText.length} / 2000</span>
            </div>
          </div>
        </section>

        {/* Right Column: Live Dataset Metrics & Verified Table Explorer (5 Columns) */}
        <section
          className="lg:col-span-5 space-y-6 flex flex-col justify-start"
          aria-label="Dataset metrics and catalog explorer"
        >
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Orders</span>
                <Package className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {summary ? summary.totalOrders : (health?.dataset.totalOrders ?? '60')}
              </div>
              <p className="text-[11px] text-slate-400">
                {summary ? `${summary.uniqueCustomers} customers` : 'From orders.csv'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Revenue</span>
                <IndianRupee className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400">
                {summary
                  ? `₹${summary.totalRevenueInr.toLocaleString('en-IN')}`
                  : health
                  ? `₹${health.dataset.totalRevenueInr.toLocaleString('en-IN')}`
                  : '₹2,78,410'}
              </div>
              <p className="text-[11px] text-slate-400">Verified monetary totals</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Regions</span>
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white">
                {summary ? `${summary.uniqueCities} Cities` : '6 Cities'}
              </div>
              <p className="text-[11px] text-slate-400">
                {summary ? `${summary.dateRange.from} to ${summary.dateRange.to}` : 'Active metro areas'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider">Model</span>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-purple-300">
                {health?.aiConfig.model ? health.aiConfig.model.replace('gemini-', '') : '3.8-flash'}
              </div>
              <p className="text-[11px] text-slate-400">
                {health?.aiConfig.keyConfigured ? 'API Key Active' : 'Interactions API'}
              </p>
            </div>
          </div>

          {/* Status Distribution Pills */}
          {summary?.statusCounts && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Order Status Breakdown
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.statusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className={`px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1.5 ${getStatusBadge(
                      status
                    )}`}
                  >
                    <span className="capitalize">{status}</span>
                    <span className="px-1 py-0.2 rounded bg-white/10 font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Table Preview */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-xs sm:text-sm">
                  Verified Dataset Sample
                </h3>
                <p className="text-[11px] text-slate-400">
                  Data analyzed by Gemini tools in real-time
                </p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {recentOrders.length} rows
              </span>
            </div>

            <div className="overflow-x-auto max-h-[220px]">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-950/80 text-slate-400 font-medium uppercase tracking-wider sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {recentOrders.map((order) => (
                    <tr key={order.order_id} className="hover:bg-slate-800/40 transition">
                      <td className="px-3 py-2 font-mono font-medium text-blue-400">
                        {order.order_id}
                      </td>
                      <td className="px-3 py-2 text-white font-medium truncate max-w-[100px]">
                        {order.customer_name}
                      </td>
                      <td className="px-3 py-2 text-slate-300 truncate max-w-[110px]">
                        {order.product}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-400 font-medium whitespace-nowrap">
                        ₹{order.total_inr.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* System Diagnostics */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/90 text-[11px] space-y-1 text-slate-400">
            <div className="flex items-center gap-1.5 font-medium text-slate-300 mb-1">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span>System & API Diagnostics</span>
            </div>
            <div className="font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/60 space-y-1">
              <div>Health: {health?.status ?? 'Connecting'} (Uptime: {health?.uptimeSeconds ?? 0}s)</div>
              <div>Dataset: {health?.dataset?.totalOrders ?? 60} records validated with Zod</div>
              <div>Last Synced: {lastChecked || 'Initial load'}</div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Orderly AI © 2026 · Screening Task for Torcue AI</span>
          <div className="flex items-center gap-3 text-slate-400">
            <span>React 19 + TypeScript</span>
            <span>·</span>
            <span>Express ES Modules</span>
            <span>·</span>
            <span>Gemini Function Calling</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
