import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataService } from '../../server/services/dataService.js';
import {
  lookup_order,
  search_orders,
  calculate_order_metrics,
  executeTool,
  getToolLabel,
} from '../../server/tools/orderTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validCsvPath = path.resolve(__dirname, '../../data/orders.csv');

describe('Order Tools Suite', () => {
  beforeAll(() => {
    dataService.loadAndValidateOrders(validCsvPath);
  });

  describe('lookup_order', () => {
    it('should return structured order for an existing order ID (ORD-1025)', () => {
      const res = lookup_order({ order_id: 'ORD-1025' });

      expect(res.success).toBe(true);
      expect(res.found).toBe(true);
      expect(res.order).toBeDefined();
      expect(res.order.order_id).toBe('ORD-1025');
      expect(res.order.customer_name).toBe('Karthik Rao');
      expect(res.order.product).toBe('Wireless Mouse');
      expect(res.order.category).toBe('Electronics');
      expect(res.order.quantity).toBe(3);
      expect(res.order.unit_price_inr).toBe(799);
      expect(res.order.total_inr).toBe(2397);
      expect(res.order.status).toBe('delivered');
    });

    it('should handle lowercase order ID gracefully (ord-1025)', () => {
      const res = lookup_order({ order_id: 'ord-1025' });

      expect(res.success).toBe(true);
      expect(res.found).toBe(true);
      expect(res.order.order_id).toBe('ORD-1025');
    });

    it('should return a structured not-found response for non-existent order (ORD-9999)', () => {
      const res = lookup_order({ order_id: 'ORD-9999' });

      expect(res.success).toBe(true);
      expect(res.found).toBe(false);
      expect(res.order_id).toBe('ORD-9999');
      expect(res.message).toContain('ORD-9999');
      expect(res.message).toContain('not found');
    });

    it('should return validation error for empty order_id', () => {
      const res = lookup_order({ order_id: '' });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid arguments for lookup_order');
      expect(res.details).toBeDefined();
    });
  });

  describe('search_orders', () => {
    it('should filter orders with case-insensitive customer name and category', () => {
      const res = search_orders({ customer_name: 'rohan', category: 'electronics' });

      expect(res.success).toBe(true);
      expect(res.total_matches).toBeGreaterThan(0);
      expect(
        res.orders.every(
          (o) =>
            o.customer_name.toLowerCase().includes('rohan') &&
            o.category.toLowerCase() === 'electronics'
        )
      ).toBe(true);
    });

    it('should filter orders within inclusive date-range boundaries', () => {
      const res = search_orders({
        start_date: '2026-06-01',
        end_date: '2026-06-15',
      });

      expect(res.success).toBe(true);
      expect(res.total_matches).toBeGreaterThan(0);
      expect(
        res.orders.every(
          (o) => o.order_date >= '2026-06-01' && o.order_date <= '2026-06-15'
        )
      ).toBe(true);
    });

    it('should return empty result set cleanly when no orders match', () => {
      const res = search_orders({ customer_name: 'NonExistentPersonXYZ' });

      expect(res.success).toBe(true);
      expect(res.total_matches).toBe(0);
      expect(res.returned_count).toBe(0);
      expect(res.orders).toEqual([]);
      expect(res.message).toBeDefined();
    });

    it('should respect bounded limits (max 25)', () => {
      const res = search_orders({ limit: 5 });

      expect(res.success).toBe(true);
      expect(res.returned_count).toBe(5);
      expect(res.limit_applied).toBe(5);
    });
  });

  describe('calculate_order_metrics', () => {
    it('should correctly count cancelled orders (exactly 7)', () => {
      const res = calculate_order_metrics({
        metric: 'count_orders',
        status: 'cancelled',
      });

      expect(res.success).toBe(true);
      expect(res.count).toBe(7);
      expect(res.filters_applied.status).toBe('cancelled');
    });

    it('should calculate category revenue for Electronics in August 2026 (₹16,692)', () => {
      // 4 orders for Electronics in Aug 2026:
      // ORD-1033: 3798 (delivered)
      // ORD-1034: 10497 (delivered)
      // ORD-1041: 10497 (cancelled) - EXCLUDED by rule
      // ORD-1046: 2397 (delivered)
      // Total revenue = 3798 + 10497 + 2397 = 16,692
      const res = calculate_order_metrics({
        metric: 'sum_revenue',
        category: 'Electronics',
        month: 8,
        year: 2026,
      });

      expect(res.success).toBe(true);
      expect(res.total_revenue_inr).toBe(16692);
      expect(res.formatted_revenue).toBe('₹16,692');
      expect(res.order_count).toBe(3);
      expect(res.filters_applied.cancelled_orders_excluded).toBe(true);
    });

    it('should calculate top-spending customer (Rohan Das with ₹1,12,282)', () => {
      const res = calculate_order_metrics({
        metric: 'top_customer_spend',
      });

      expect(res.success).toBe(true);
      expect(res.top_customer).toBeDefined();
      expect(res.top_customer.customer_name).toBe('Rohan Das');
      expect(res.top_customer.total_spent_inr).toBe(112282);
      expect(res.top_customer.formatted_spent).toBe('₹1,12,282');
      expect(res.top_customers_ranked.length).toBeGreaterThan(1);
      expect(res.top_customers_ranked[1].customer_name).toBe('Vikram Reddy');
    });

    it('should calculate count_by_status distribution across all orders', () => {
      const res = calculate_order_metrics({
        metric: 'count_by_status',
      });

      expect(res.success).toBe(true);
      expect(res.counts_by_status).toEqual({
        delivered: 48,
        cancelled: 7,
        returned: 3,
        processing: 1,
        shipped: 1,
      });
      expect(res.total).toBe(60);
    });

    it('should gracefully handle empty matches without errors', () => {
      const res = calculate_order_metrics({
        metric: 'sum_revenue',
        category: 'NonExistentCategory',
      });

      expect(res.success).toBe(true);
      expect(res.total_revenue_inr).toBe(0);
      expect(res.order_count).toBe(0);
    });

    it('should reject invalid metric name with validation error', () => {
      const res = calculate_order_metrics({
        metric: 'invalid_metric_xyz',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid arguments for calculate_order_metrics');
    });
  });

  describe('executeTool & getToolLabel', () => {
    it('should reject unknown tool names that are not in the allowlist', () => {
      const res = executeTool('delete_all_orders', {});

      expect(res.success).toBe(false);
      expect(res.error).toContain('Unknown tool "delete_all_orders"');
      expect(res.error).toContain('Allowlisted tools are');
    });

    it('should dispatch valid tool calls successfully', () => {
      const res = executeTool('lookup_order', { order_id: 'ORD-1001' });

      expect(res.success).toBe(true);
      expect(res.found).toBe(true);
      expect(res.order.product).toBe('Wireless Mouse');
    });

    it('should generate informative, sanitized tool labels', () => {
      expect(getToolLabel('lookup_order', { order_id: 'ORD-1025' })).toBe(
        'Looking up order ORD-1025'
      );
      expect(
        getToolLabel('calculate_order_metrics', {
          metric: 'sum_revenue',
          category: 'Electronics',
          month: 8,
          year: 2026,
        })
      ).toBe('Calculating revenue (Electronics Aug 2026)');
      expect(
        getToolLabel('calculate_order_metrics', {
          metric: 'top_customer_spend',
        })
      ).toBe('Analyzing top-spending customer');
      expect(
        getToolLabel('calculate_order_metrics', {
          metric: 'count_orders',
          status: 'cancelled',
        })
      ).toBe('Counting cancelled orders');
    });
  });
});
