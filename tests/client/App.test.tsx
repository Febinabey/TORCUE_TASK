// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../../src/App.tsx';

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('Frontend App Component & Chat Interface', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Default mock for GET /api/health and GET /api/orders/summary and GET /api/orders
    global.fetch = vi.fn((url: RequestInfo | URL) => {
      const urlStr = String(url);

      if (urlStr.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: 'ok',
              service: 'orderly-ai',
              version: '0.1.0',
              timestamp: '2026-10-09T04:00:00Z',
              uptimeSeconds: 120,
              environment: 'test',
              dataset: {
                loaded: true,
                filePath: 'data/orders.csv',
                totalOrders: 60,
                totalRevenueInr: 278410,
              },
              aiConfig: {
                provider: 'Gemini',
                model: 'gemini-3.8-flash',
                keyConfigured: true,
              },
            }),
        } as Response);
      }

      if (urlStr.includes('/api/orders/summary')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              totalOrders: 60,
              totalRevenueInr: 278410,
              dateRange: { from: '2026-06-01', to: '2026-09-28' },
              uniqueCustomers: 12,
              uniqueProducts: 13,
              uniqueCategories: 4,
              uniqueCities: 6,
              statusCounts: {
                delivered: 48,
                cancelled: 7,
                returned: 3,
                processing: 1,
                shipped: 1,
              },
              categoryCounts: {},
              cityCounts: {},
            }),
        } as Response);
      }

      if (urlStr.includes('/api/orders')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              total: 60,
              returned: 1,
              orders: [
                {
                  order_id: 'ORD-1001',
                  order_date: '2026-06-01',
                  customer_name: 'Rahul Sharma',
                  city: 'Hyderabad',
                  product: 'Wireless Mouse',
                  category: 'Electronics',
                  quantity: 2,
                  unit_price_inr: 799,
                  total_inr: 1598,
                  payment_method: 'Debit Card',
                  status: 'delivered',
                },
              ],
            }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL in test mock: ${urlStr}`));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the welcome screen and input controls initially', async () => {
    render(<App />);

    expect(screen.getByText('Welcome to Orderly AI')).toBeDefined();
    expect(screen.getByRole('button', { name: /Send message/i })).toBeDefined();
    expect(screen.getByLabelText(/Ask Orderly AI about orders/i)).toBeDefined();
  });

  it('submits a message to /api/chat and renders the actual returned assistant reply and tool events', async () => {
    // Add mock implementation for POST /api/chat
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/chat') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(body.message).toBe('What is the status of order ORD-1025?');

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              reply:
                'Order ORD-1025 for Karthik Rao in Kochi has been delivered.',
              toolEvents: [
                {
                  name: 'lookup_order',
                  label: 'Looking up order ORD-1025',
                  status: 'success',
                },
              ],
            }),
        } as Response);
      }
      return originalFetch(url, init);
    });

    render(<App />);

    const textarea = screen.getByLabelText(/Ask Orderly AI about orders/i);
    const sendButton = screen.getByRole('button', { name: /Send message/i });

    // Type the question in textarea and click send
    fireEvent.change(textarea, {
      target: { value: 'What is the status of order ORD-1025?' },
    });
    fireEvent.click(sendButton);

    // Should immediately display user message
    expect(screen.getByText('What is the status of order ORD-1025?')).toBeDefined();

    // Await assistant reply from API
    await waitFor(() => {
      expect(
        screen.getByText(
          'Order ORD-1025 for Karthik Rao in Kochi has been delivered.'
        )
      ).toBeDefined();
    });

    // Verify tool activity label is displayed
    expect(screen.getByText('Looking up order ORD-1025')).toBeDefined();
  });

  it('disables repeated submissions while request is pending and shows loading indicator', async () => {
    let resolveChatPromise: (val: unknown) => void = () => {};
    const chatPromise = new Promise((resolve) => {
      resolveChatPromise = resolve;
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/chat') && init?.method === 'POST') {
        return chatPromise as Promise<Response>;
      }
      return originalFetch(url, init);
    });

    render(<App />);

    const textarea = screen.getByLabelText(/Ask Orderly AI about orders/i);
    const sendButton = screen.getByRole('button', { name: /Send message/i });

    // Type a message
    fireEvent.change(textarea, { target: { value: 'How many orders were cancelled?' } });
    expect((sendButton as HTMLButtonElement).disabled).toBe(false);

    // Click send
    fireEvent.click(sendButton);

    // Verify loading indicator is shown
    expect(screen.getByText(/Orderly AI is processing your request via Gemini/i)).toBeDefined();

    // Verify send button is disabled during submission
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);

    // Resolve the pending promise
    resolveChatPromise({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          reply: 'There are 7 cancelled orders in the database.',
          toolEvents: [
            {
              name: 'calculate_order_metrics',
              label: 'Counting cancelled orders',
              status: 'success',
            },
          ],
        }),
    });

    await waitFor(() => {
      expect(
        screen.getByText('There are 7 cancelled orders in the database.')
      ).toBeDefined();
    });

    // Loading should disappear in finally block
    expect(
      screen.queryByText(/Orderly AI is processing your request via Gemini/i)
    ).toBeNull();
  });

  it('gracefully handles an HTTP error and displays retryable error state', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/chat') && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () =>
            Promise.resolve({
              error: 'Service Unavailable',
              message: 'Gemini API key is not configured on the server.',
            }),
        } as Response);
      }
      return originalFetch(url, init);
    });

    render(<App />);

    const textarea = screen.getByLabelText(/Ask Orderly AI about orders/i);
    const sendButton = screen.getByRole('button', { name: /Send message/i });

    fireEvent.change(textarea, { target: { value: 'Which customer spent the most?' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(
        screen.getByText('Gemini API key is not configured on the server.')
      ).toBeDefined();
    });

    // Retry button should be visible
    expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
  });

  it('clears the conversation and resets to welcome screen when Reset Chat is clicked', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/chat') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              reply: 'Test response.',
              toolEvents: [],
            }),
        } as Response);
      }
      return originalFetch(url, init);
    });

    render(<App />);

    const textarea = screen.getByLabelText(/Ask Orderly AI about orders/i);
    const sendButton = screen.getByRole('button', { name: /Send message/i });

    // Send a message
    fireEvent.change(textarea, {
      target: { value: 'What is the status of order ORD-1025?' },
    });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Test response.')).toBeDefined();
    });

    // Find and click Reset Chat button
    const resetBtn = screen.getByRole('button', { name: /Clear conversation/i });
    expect(resetBtn).toBeDefined();
    fireEvent.click(resetBtn);

    // Welcome screen should reappear
    await waitFor(() => {
      expect(screen.getByText('Welcome to Orderly AI')).toBeDefined();
    });
    expect(screen.queryByText('Test response.')).toBeNull();
  });
});
