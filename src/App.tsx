import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Package,
  IndianRupee,
  RefreshCw,
  Bot,
  Send,
  RotateCcw,
  Check,
  Users,
  Layers,
  Copy,
  Search,
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

/**
 * Bespoke Orderly AI Geometric Brand Logo
 */
export function OrderlyLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="orderly-top" x1="6" y1="6" x2="34" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="orderly-left" x1="4" y1="16" x2="20" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#3730A3" />
        </linearGradient>
        <linearGradient id="orderly-right" x1="20" y1="16" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4338CA" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
        <linearGradient id="orderly-core" x1="16" y1="10" x2="24" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#818CF8" />
        </linearGradient>
      </defs>
      <path
        d="M20 5.5L34 13.5L20 21.5L6 13.5L20 5.5Z"
        fill="url(#orderly-top)"
      />
      <path
        d="M6 15.2L20 23.2V35L6 27V15.2Z"
        fill="url(#orderly-left)"
      />
      <path
        d="M20 23.2L34 15.2V27L20 35V23.2Z"
        fill="url(#orderly-right)"
      />
      <ellipse
        cx="20"
        cy="13.5"
        rx="5.5"
        ry="3.2"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        strokeOpacity="0.9"
      />
      <circle
        cx="20"
        cy="13.5"
        r="1.8"
        fill="url(#orderly-core)"
      />
    </svg>
  );
}

/**
 * Clean Message Content Formatter:
 * Seamlessly formats markdown tables without broken layout
 */
function FormattedMessageContent({ content }: { content: string }) {
  const hasMarkdownTable = content.includes('|') && content.includes('---');

  if (!hasMarkdownTable) {
    return (
      <div className="whitespace-pre-wrap leading-relaxed text-slate-800 font-normal">
        {content}
      </div>
    );
  }

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = (key: number) => {
    if (tableBuffer.length < 2) {
      renderedElements.push(
        <div key={key} className="whitespace-pre-wrap my-1 text-slate-800">
          {tableBuffer.join('\n')}
        </div>
      );
      tableBuffer = [];
      return;
    }

    const headerLine = tableBuffer[0];
    const dataLines = tableBuffer.slice(2);

    const headers = headerLine
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    renderedElements.push(
      <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              {headers.map((h, hIdx) => (
                <th key={hIdx} className="px-3 py-2">
                  {h.replace(/\*\*/g, '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {dataLines.map((row, rIdx) => {
              const cells = row
                .split('|')
                .map((c) => c.trim())
                .filter((c) => c.length > 0);
              return (
                <tr key={rIdx} className="hover:bg-slate-50/70 transition">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-700">
                      {cell.replace(/\*\*/g, '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableBuffer.push(trimmed);
    } else {
      if (inTable) {
        flushTable(idx);
        inTable = false;
      }
      if (trimmed) {
        renderedElements.push(
          <p key={`p-${idx}`} className="my-1 text-slate-800 leading-relaxed">
            {line}
          </p>
        );
      }
    }
  });

  if (inTable && tableBuffer.length > 0) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{renderedElements}</div>;
}

export default function App() {
  // System and Dataset State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Table Filters State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

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
        fetch('/api/orders?limit=100'),
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

    // Keep-alive ping every 4 minutes to prevent Render free-tier instance sleep while tab is open
    const interval = setInterval(() => {
      fetch('/api/health').catch(() => {});
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtered orders in the interactive table
  const filteredOrders = useMemo(() => {
    return recentOrders.filter((order) => {
      const matchesStatus =
        statusFilter === 'all' ||
        order.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        order.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.city.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [recentOrders, statusFilter, searchQuery]);

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

  const handleCopyMessage = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
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

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-[#171A2C] flex flex-col md:flex-row font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Clean Left Sidebar */}
      <aside className="w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-slate-900 shadow-sm flex items-center justify-center">
              <OrderlyLogo className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">
              Orderly AI
            </span>
          </div>

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

        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
          <nav className="space-y-1">
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-50/80 text-indigo-700 border border-indigo-100/70 transition"
              aria-current="page"
            >
              <Bot className="w-4 h-4 text-indigo-600" />
              <span>Order Assistant</span>
            </button>
          </nav>

          <div className="hidden md:flex flex-col space-y-2 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700">
                {summary?.totalOrders ?? (health?.dataset.totalOrders || 60)} orders synced
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Workspace Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Order Operations Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Real-time order tracking, catalog analytics, and fulfillment management.
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 self-start sm:self-auto">
            {health?.status === 'ok' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            ) : healthError ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5" />
                Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Connecting...
              </span>
            )}

            <button
              onClick={fetchHealthAndData}
              disabled={healthLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition disabled:opacity-50 cursor-pointer"
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
          {/* Metrics Row (4 Clean Cards) */}
          <section
            aria-label="Dataset key metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            {/* 1. Total Orders */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-2xs">
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
            </div>

            {/* 2. Recorded Order Value */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-2xs">
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
            </div>

            {/* 3. Unique Customers */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-2xs">
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
            </div>

            {/* 4. Product Categories */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 shadow-2xs">
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
                  summary.uniqueCategories
                ) : (
                  '—'
                )}
              </div>
            </div>
          </section>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Clean AI Order Assistant */}
            <section
              className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col h-[740px] overflow-hidden"
              aria-label="Chat assistant panel"
            >
              {/* Chat Panel Header */}
              <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-2xs">
                    <OrderlyLogo className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 leading-tight">
                      Order Assistant
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Grounded in your store's verified order records
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
                  /* Minimal Empty Welcome State (No bulky cards) */
                  <div className="h-full flex flex-col justify-center items-center text-center px-4 max-w-md mx-auto">
                    <div className="p-3 rounded-2xl bg-slate-900 shadow-sm mb-3">
                      <OrderlyLogo className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1.5">
                      Welcome to Orderly AI
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm">
                      Ask anything about your store's orders, revenue, customers, or fulfillment.
                    </p>
                  </div>
                ) : (
                  /* Active Messages */
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`flex gap-2.5 max-w-[94%] sm:max-w-[88%] ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                            <OrderlyLogo className="w-4 h-4" />
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-2xs ${
                            msg.role === 'user'
                              ? 'bg-indigo-50 border border-indigo-100 text-slate-900 rounded-br-xs'
                              : msg.isError
                              ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-bl-xs'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                          }`}
                        >
                          {/* Copy button */}
                          {msg.role === 'assistant' && !msg.isError && (
                            <div className="flex justify-end mb-1">
                              <button
                                onClick={() => handleCopyMessage(msg.id, msg.content)}
                                className="text-slate-400 hover:text-slate-600 transition text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                title="Copy text"
                              >
                                {copiedMessageId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-600">Copied</span>
                                  </>
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}

                          {/* Tool Activity Badges */}
                          {msg.toolEvents && msg.toolEvents.length > 0 && (
                            <div className="mb-2.5 pb-2.5 border-b border-slate-100 flex flex-wrap gap-1.5">
                              {msg.toolEvents.map((evt, eIdx) => (
                                <span
                                  key={eIdx}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium border ${
                                    evt.status === 'success'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
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

                          <FormattedMessageContent content={msg.content} />

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

                {chatLoading && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                      <OrderlyLogo className="w-4 h-4" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 text-xs sm:text-sm text-slate-600 shadow-2xs flex items-center gap-3">
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
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 mt-2">
                  <span>
                    Press <kbd className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200 text-[10px]">Enter</kbd> to submit · <kbd className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200 text-[10px]">Shift+Enter</kbd> for newline
                  </span>
                  <span>{inputText.length} / 2000</span>
                </div>
              </div>
            </section>

            {/* Right Column: Clean Orders Table */}
            <section
              className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[740px]"
              aria-label="Dataset overview and transaction records"
            >
              {/* Orders Header */}
              <div className="px-4 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Store Orders
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    {filteredOrders.length === recentOrders.length
                      ? `${filteredOrders.length} orders`
                      : `${filteredOrders.length} of ${recentOrders.length}`}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 pr-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32 sm:w-40 transition"
                  />
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1 overflow-x-auto text-[11px] bg-slate-50/50">
                {['all', 'delivered', 'cancelled', 'returned', 'shipped', 'processing'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-medium capitalize transition cursor-pointer shrink-0 ${
                      statusFilter === f
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Table Body */}
              <div className="overflow-x-auto flex-1">
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
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">
                          {healthLoading ? 'Loading orders...' : 'No orders found'}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr
                          key={order.order_id}
                          className="hover:bg-indigo-50/30 transition group cursor-pointer"
                          onClick={() => {
                            handleSendMessage(`What is the status of order ${order.order_id}?`);
                          }}
                          title={`Ask about order ${order.order_id}`}
                        >
                          <td className="px-3.5 py-2 font-mono font-semibold text-indigo-600 group-hover:underline">
                            {order.order_id}
                          </td>
                          <td className="px-3.5 py-2">
                            <div className="font-semibold text-slate-900 truncate max-w-[130px]">
                              {order.product}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                              {order.customer_name} · {order.city}
                            </div>
                          </td>
                          <td className="px-3.5 py-2 text-right font-mono text-emerald-700 font-semibold whitespace-nowrap">
                            ₹{order.total_inr.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(
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
            </section>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-3.5 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <span>Orderly AI © 2026</span>
            <span>All store data verified</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
