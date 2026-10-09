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
  RotateCcw,
  Check,
  Users,
  Layers,
  ChevronDown,
  ChevronUp,
  XCircle,
  TrendingUp,
  Database,
  ArrowRight,
  ShieldCheck,
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

interface SuggestedPromptItem {
  question: string;
  tag: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SUGGESTED_PROMPTS: SuggestedPromptItem[] = [
  {
    question: 'What is the status of order ORD-1025?',
    tag: 'Order Lookup',
    desc: 'Inspect customer, product, and delivery state',
    icon: Package,
  },
  {
    question: 'How many orders were cancelled?',
    tag: 'Status Audit',
    desc: 'Audit cancelled orders and refund statuses',
    icon: XCircle,
  },
  {
    question: 'What was the revenue from Electronics in August 2026?',
    tag: 'Revenue Metrics',
    desc: 'Filter catalog sales by category and date span',
    icon: TrendingUp,
  },
  {
    question: 'Which customer has spent the most?',
    tag: 'Customer Ranking',
    desc: 'Identify top purchaser across all recorded orders',
    icon: Users,
  },
];

export default function App() {
  // System and Dataset State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

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
      if (typeof window !== 'undefined' && window.innerWidth > 768) {
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'returned':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'processing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  // Compute status totals for segmented bar
  const totalStatusCount = summary?.statusCounts
    ? Object.values(summary.statusCounts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-[#171A2C] flex flex-col md:flex-row font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Slim Left Sidebar (240px Desktop, sleek header on mobile) */}
      <aside className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-slate-900">
                  Orderly AI
                </span>
              </div>
              <p className="text-[10px] font-semibold tracking-wider text-indigo-600 uppercase">
                Order Intelligence
              </p>
            </div>
          </div>

          {/* Mobile status indicator pill */}
          <div className="md:hidden">
            {health?.status === 'ok' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
          <nav className="space-y-1">
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Operations
            </div>
            <button
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium bg-indigo-50/80 text-indigo-700 border border-indigo-100/80 transition"
              aria-current="page"
            >
              <div className="flex items-center gap-2.5">
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>Assistant</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100/90 font-semibold text-indigo-700">
                Active
              </span>
            </button>
            <a
              href="#dataset-section"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            >
              <Database className="w-4 h-4 text-slate-400" />
              <span>Dataset Records</span>
            </a>
          </nav>

          {/* Dataset Status Area & Health Details near bottom */}
          <div className="hidden md:flex flex-col space-y-3 pt-4 border-t border-slate-100">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Data Source
                </span>
                <span className="text-[10px] text-slate-400">CSV v1</span>
              </div>
              <div className="font-mono text-xs font-semibold text-slate-800">
                data/orders.csv
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                {health?.dataset?.loaded ? (
                  <span className="text-emerald-700 font-medium inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{health.dataset.totalOrders || 60} verified orders</span>
                  </span>
                ) : healthLoading ? (
                  <span className="text-slate-500 inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                    Loading dataset...
                  </span>
                ) : (
                  <span className="text-rose-600 font-medium inline-flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Dataset unverified
                  </span>
                )}
              </div>
            </div>

            <div className="px-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{health?.aiConfig?.model || 'gemini-3.8-flash'}</span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                Grounded
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Workspace Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div>
            <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-0.5">
              Workspace · Operations Intelligence
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Your orders, understood.
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Ask questions about orders, revenue, customers, and fulfilment.
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 self-start sm:self-auto">
            {health?.status === 'ok' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Backend & Dataset Online
              </span>
            ) : healthError ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                Backend Disconnected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Connecting...
              </span>
            )}

            <button
              onClick={fetchHealthAndData}
              disabled={healthLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="Refresh status from /api/health"
              aria-label="Refresh system status"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 ${
                  healthLoading ? 'animate-spin text-indigo-600' : ''
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Metrics Row (4 Cards with skeleton loading & zero hardcoded fake revenue) */}
          <section
            aria-label="Dataset key metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            {/* 1. Total Orders */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Orders
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {healthLoading ? (
                  <div className="h-7 w-16 bg-slate-200 animate-pulse rounded my-0.5" />
                ) : summary ? (
                  summary.totalOrders
                ) : health?.dataset.totalOrders != null ? (
                  health.dataset.totalOrders
                ) : (
                  '—'
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {summary ? `${summary.uniqueCustomers} unique customers` : 'From orders.csv'}
              </p>
            </div>

            {/* 2. Recorded Order Value */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Recorded Order Value
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-700 tracking-tight">
                {healthLoading ? (
                  <div className="h-7 w-24 bg-slate-200 animate-pulse rounded my-0.5" />
                ) : summary ? (
                  `₹${summary.totalRevenueInr.toLocaleString('en-IN')}`
                ) : health?.dataset.totalRevenueInr != null ? (
                  `₹${health.dataset.totalRevenueInr.toLocaleString('en-IN')}`
                ) : (
                  '—'
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Gross catalog transaction sum
              </p>
            </div>

            {/* 3. Unique Customers */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Unique Customers
                </span>
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {healthLoading ? (
                  <div className="h-7 w-12 bg-slate-200 animate-pulse rounded my-0.5" />
                ) : summary?.uniqueCustomers != null ? (
                  summary.uniqueCustomers
                ) : (
                  '—'
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {summary ? `Across ${summary.uniqueCities} cities` : 'Active buyer accounts'}
              </p>
            </div>

            {/* 4. Product Categories */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Product Categories
                </span>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {healthLoading ? (
                  <div className="h-7 w-14 bg-slate-200 animate-pulse rounded my-0.5" />
                ) : summary?.uniqueCategories != null ? (
                  `${summary.uniqueCategories} Categories`
                ) : (
                  '—'
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {summary ? `${summary.uniqueProducts} catalog products` : 'Verified catalog items'}
              </p>
            </div>
          </section>

          {/* Two-Column Core Layout (Chat ~60-65%, Dataset Overview ~35-40%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Interactive AI Order Assistant */}
            <section
              className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[750px] overflow-hidden"
              aria-label="Chat assistant panel"
            >
              {/* Chat Panel Header */}
              <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-tight">
                      Order Assistant
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Powered by Gemini · Grounded in your order data
                    </p>
                  </div>
                </div>

                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                    title="Clear current conversation"
                    aria-label="Clear conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Chat</span>
                  </button>
                )}
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#FAFAFC]">
                {messages.length === 0 ? (
                  /* Welcome Screen & 2x2 Suggested Questions Grid */
                  <div className="h-full flex flex-col justify-center items-center text-center px-2 py-4 max-w-xl mx-auto">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1.5">
                      Welcome to Orderly AI
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 max-w-md">
                      What would you like to know? Ask about order status, catalog revenue, cancellations, or customer rankings.
                    </p>

                    <div className="w-full space-y-2.5 text-left">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                        Suggested Inquiries
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {SUGGESTED_PROMPTS.map((item, idx) => {
                          const IconComp = item.icon;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSendMessage(item.question)}
                              disabled={chatLoading}
                              className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 hover:shadow-xs transition group text-left flex flex-col justify-between cursor-pointer"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    {item.tag}
                                  </span>
                                  <IconComp className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
                                </div>
                                <div className="font-semibold text-xs sm:text-[13px] text-slate-900 group-hover:text-indigo-700 transition leading-snug">
                                  {item.question}
                                </div>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                                <span>{item.desc}</span>
                                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Conversation Stream */
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`flex gap-2.5 max-w-[92%] sm:max-w-[85%] ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-xs ${
                            msg.role === 'user'
                              ? 'bg-indigo-50 border border-indigo-100 text-slate-900 rounded-br-xs'
                              : msg.isError
                              ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-bl-xs'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                          }`}
                        >
                          {/* Tool Activity Badges */}
                          {msg.toolEvents && msg.toolEvents.length > 0 && (
                            <div className="mb-2.5 pb-2.5 border-b border-slate-100 flex flex-wrap gap-1.5">
                              {msg.toolEvents.map((evt, eIdx) => (
                                <span
                                  key={eIdx}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${
                                    evt.status === 'success'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                  title={`Tool: ${evt.name} (${evt.status})`}
                                >
                                  {evt.status === 'success' ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                  )}
                                  <span>{evt.label}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Message Content */}
                          <div className="whitespace-pre-wrap leading-relaxed text-slate-800 font-normal">
                            {msg.content}
                          </div>

                          {/* Retry Button on Error */}
                          {msg.isError && msg.canRetry && (
                            <div className="mt-3 pt-2.5 border-t border-rose-200 flex items-center justify-between">
                              <span className="text-xs text-rose-700 font-medium">
                                Something went wrong.
                              </span>
                              <button
                                onClick={handleRetry}
                                disabled={chatLoading}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-medium transition cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Retry</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] text-slate-400 mt-1 px-1 ${
                          msg.role === 'assistant' ? 'ml-9' : ''
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  ))
                )}

                {/* Loading Indicator */}
                {chatLoading && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 text-xs sm:text-sm text-slate-600 shadow-xs flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                      <span className="animate-pulse">
                        Orderly AI is processing your request via Gemini...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Anchored Bottom Composer */}
              <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end gap-2.5"
                >
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything about your orders… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      maxLength={2000}
                      disabled={chatLoading}
                      aria-label="Ask Orderly AI about orders"
                      className="w-full resize-none rounded-xl bg-slate-50/70 border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={chatLoading || !inputText.trim()}
                    aria-label="Send message"
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
                  <span>
                    Press <kbd className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200 text-[10px]">Enter</kbd> to submit · <kbd className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200 text-[10px]">Shift+Enter</kbd> for newline
                  </span>
                  <span>{inputText.length} / 2000</span>
                </div>
              </div>
            </section>

            {/* Right Column: Coherent Dataset Overview Panel */}
            <section
              id="dataset-section"
              className="lg:col-span-5 space-y-4"
              aria-label="Dataset overview and transaction records"
            >
              {/* 1. Validated Dataset Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Dataset Overview
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Validated local store transaction records
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {summary?.totalOrders ?? (health?.dataset.totalOrders || 60)} orders
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Active Period
                    </span>
                    <span className="font-medium text-slate-800 text-[11px]">
                      {summary?.dateRange
                        ? `${summary.dateRange.from} to ${summary.dateRange.to}`
                        : 'Jun 2026 – Sep 2026'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Geographies
                    </span>
                    <span className="font-medium text-slate-800 text-[11px] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {summary ? `${summary.uniqueCities} Metro Cities` : '6 Metro Cities'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Order Status Breakdown with Proportional Segmented Bar */}
              {summary?.statusCounts && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status Distribution
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {totalStatusCount} total
                    </span>
                  </div>

                  {/* Segmented Proportional Bar */}
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-0.5">
                    {Object.entries(summary.statusCounts).map(([status, count]) => {
                      const pct = totalStatusCount > 0 ? (count / totalStatusCount) * 100 : 0;
                      let barColor = 'bg-slate-400';
                      if (status === 'delivered') barColor = 'bg-emerald-500';
                      else if (status === 'cancelled') barColor = 'bg-rose-500';
                      else if (status === 'returned') barColor = 'bg-amber-500';
                      else if (status === 'shipped') barColor = 'bg-blue-500';
                      else if (status === 'processing') barColor = 'bg-indigo-500';

                      return (
                        <div
                          key={status}
                          style={{ width: `${pct}%` }}
                          className={`${barColor} transition-all`}
                          title={`${status}: ${count} (${pct.toFixed(0)}%)`}
                        />
                      );
                    })}
                  </div>

                  {/* Badges list */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(summary.statusCounts).map(([status, count]) => (
                      <div
                        key={status}
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1.5 ${getStatusBadge(
                          status
                        )}`}
                      >
                        <span className="capitalize">{status}</span>
                        <span className="px-1 py-0.2 rounded bg-black/5 font-semibold">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Recent Orders Data Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">
                      Recent Orders
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Sample records queried by function tools
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {recentOrders.length} rows
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[260px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-medium uppercase tracking-wider sticky top-0 border-b border-slate-200 text-[10px]">
                      <tr>
                        <th className="px-3.5 py-2 font-semibold">Order ID</th>
                        <th className="px-3.5 py-2 font-semibold">Product</th>
                        <th className="px-3.5 py-2 text-right font-semibold">Total</th>
                        <th className="px-3.5 py-2 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {recentOrders.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            {healthLoading ? 'Loading verified order records...' : 'No orders loaded'}
                          </td>
                        </tr>
                      ) : (
                        recentOrders.map((order) => (
                          <tr key={order.order_id} className="hover:bg-slate-50/80 transition">
                            <td className="px-3.5 py-2 font-mono font-medium text-indigo-600">
                              {order.order_id}
                            </td>
                            <td className="px-3.5 py-2">
                              <div className="font-medium text-slate-900 truncate max-w-[130px]">
                                {order.product}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                                {order.customer_name}
                              </div>
                            </td>
                            <td className="px-3.5 py-2 text-right font-mono text-emerald-700 font-medium whitespace-nowrap">
                              ₹{order.total_inr.toLocaleString('en-IN')}
                            </td>
                            <td className="px-3.5 py-2 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(
                                  order.status
                                )}`}
                              >
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Discreet Expandable System Diagnostics */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                  aria-expanded={showDiagnostics}
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-xs">System & API Diagnostics</span>
                  </div>
                  {showDiagnostics ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showDiagnostics && (
                  <div className="px-4 pb-3.5 pt-1 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5 bg-slate-50/50">
                    <div className="flex justify-between py-0.5">
                      <span>Status</span>
                      <span className="font-medium text-slate-800 font-mono">
                        {health?.status ?? 'Disconnected'}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>Server Uptime</span>
                      <span className="font-mono text-slate-800">
                        {health?.uptimeSeconds ?? 0}s
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>AI Model</span>
                      <span className="font-mono text-slate-800">
                        {health?.aiConfig?.model ?? 'gemini-3.8-flash'}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>API Key</span>
                      <span className="font-mono text-slate-800">
                        {health?.aiConfig?.keyConfigured ? 'Configured' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span>Last Checked</span>
                      <span className="font-mono text-slate-800">
                        {lastChecked || 'Initial load'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Orderly AI © 2026 · Operations Intelligence Screening</span>
            <div className="flex items-center gap-2.5 text-slate-400 text-[11px]">
              <span>React 19 + Vite</span>
              <span>·</span>
              <span>Tailwind CSS</span>
              <span>·</span>
              <span>Gemini Interactions API</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
