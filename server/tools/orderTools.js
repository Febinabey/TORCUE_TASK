import { z } from 'zod';
import { dataService } from '../services/dataService.js';

// Status enum matching the dataset
export const ORDER_STATUSES = [
  'delivered',
  'cancelled',
  'returned',
  'processing',
  'shipped',
];

// Zod schemas for tool arguments validation
export const LookupOrderArgsSchema = z.object({
  order_id: z
    .string()
    .trim()
    .min(1, 'order_id is required')
    .transform((id) => id.toUpperCase()),
});

export const SearchOrdersArgsSchema = z.object({
  order_id: z.string().trim().optional(),
  customer_name: z.string().trim().optional(),
  city: z.string().trim().optional(),
  product: z.string().trim().optional(),
  category: z.string().trim().optional(),
  status: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => ORDER_STATUSES.includes(val), {
      message: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}`,
    })
    .optional(),
  start_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be formatted as YYYY-MM-DD')
    .optional(),
  end_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be formatted as YYYY-MM-DD')
    .optional(),
  limit: z.coerce.number().int().positive().max(25).default(10),
});

export const CalculateOrderMetricsArgsSchema = z.object({
  metric: z.enum(
    ['count_orders', 'count_by_status', 'sum_revenue', 'top_customer_spend'],
    {
      errorMap: () => ({
        message:
          'metric must be one of: count_orders, count_by_status, sum_revenue, top_customer_spend',
      }),
    }
  ),
  category: z.string().trim().optional(),
  status: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => ORDER_STATUSES.includes(val), {
      message: `Invalid status. Must be one of: ${ORDER_STATUSES.join(', ')}`,
    })
    .optional(),
  city: z.string().trim().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  start_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be formatted as YYYY-MM-DD')
    .optional(),
  end_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be formatted as YYYY-MM-DD')
    .optional(),
  exclude_cancelled: z.boolean().optional(),
});

/**
 * 1. lookup_order
 * Looks up a specific order by order_id from the verified dataset.
 */
export function lookup_order(rawArgs) {
  const parseResult = LookupOrderArgsSchema.safeParse(rawArgs);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Invalid arguments for lookup_order',
      details: parseResult.error.issues.map((i) => i.message),
    };
  }

  const { order_id } = parseResult.data;
  const orders = dataService.getOrders() || [];
  const foundOrder = orders.find(
    (o) => o.order_id.toUpperCase() === order_id
  );

  if (!foundOrder) {
    return {
      success: true,
      found: false,
      order_id,
      message: `Order "${order_id}" was not found in the verified orders dataset.`,
    };
  }

  return {
    success: true,
    found: true,
    order: {
      order_id: foundOrder.order_id,
      order_date: foundOrder.order_date,
      customer_name: foundOrder.customer_name,
      city: foundOrder.city,
      product: foundOrder.product,
      category: foundOrder.category,
      quantity: foundOrder.quantity,
      unit_price_inr: foundOrder.unit_price_inr,
      total_inr: foundOrder.total_inr,
      payment_method: foundOrder.payment_method,
      status: foundOrder.status,
    },
  };
}

/**
 * 2. search_orders
 * Searches orders using case-insensitive substring filters and inclusive date boundaries.
 */
export function search_orders(rawArgs) {
  const parseResult = SearchOrdersArgsSchema.safeParse(rawArgs || {});
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Invalid arguments for search_orders',
      details: parseResult.error.issues.map((i) => i.message),
    };
  }

  const filters = parseResult.data;
  const allOrders = dataService.getOrders() || [];

  const matched = allOrders.filter((order) => {
    if (filters.order_id) {
      if (!order.order_id.toLowerCase().includes(filters.order_id.toLowerCase())) {
        return false;
      }
    }
    if (filters.customer_name) {
      if (!order.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())) {
        return false;
      }
    }
    if (filters.city) {
      if (!order.city.toLowerCase().includes(filters.city.toLowerCase())) {
        return false;
      }
    }
    if (filters.product) {
      if (!order.product.toLowerCase().includes(filters.product.toLowerCase())) {
        return false;
      }
    }
    if (filters.category) {
      if (!order.category.toLowerCase().includes(filters.category.toLowerCase())) {
        return false;
      }
    }
    if (filters.status) {
      if (order.status.toLowerCase() !== filters.status) {
        return false;
      }
    }
    if (filters.start_date) {
      if (order.order_date < filters.start_date) {
        return false;
      }
    }
    if (filters.end_date) {
      if (order.order_date > filters.end_date) {
        return false;
      }
    }
    return true;
  });

  const limit = filters.limit || 10;
  const boundedOrders = matched.slice(0, limit);

  return {
    success: true,
    total_matches: matched.length,
    returned_count: boundedOrders.length,
    limit_applied: limit,
    has_more: matched.length > limit,
    orders: boundedOrders.map((o) => ({
      order_id: o.order_id,
      order_date: o.order_date,
      customer_name: o.customer_name,
      city: o.city,
      product: o.product,
      category: o.category,
      quantity: o.quantity,
      unit_price_inr: o.unit_price_inr,
      total_inr: o.total_inr,
      payment_method: o.payment_method,
      status: o.status,
    })),
    message:
      matched.length === 0
        ? 'No orders matched the specified filter criteria.'
        : undefined,
  };
}

/**
 * 3. calculate_order_metrics
 * Performs deterministic JavaScript mathematical aggregations over orders.
 *
 * Business Rules:
 * - Order counts include all statuses unless a status filter is given.
 * - Revenue and top-customer spending exclude cancelled orders by default (exclude_cancelled defaults to true).
 * - Returned orders remain included unless explicitly filtered out (documented convention).
 * - Empty result set handled gracefully without errors.
 */
export function calculate_order_metrics(rawArgs) {
  const parseResult = CalculateOrderMetricsArgsSchema.safeParse(rawArgs || {});
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Invalid arguments for calculate_order_metrics',
      details: parseResult.error.issues.map((i) => i.message),
    };
  }

  const {
    metric,
    category,
    status,
    city,
    month,
    year,
    start_date,
    end_date,
    exclude_cancelled,
  } = parseResult.data;

  const allOrders = dataService.getOrders() || [];

  // Determine cancelled-order exclusion rule
  // For sum_revenue and top_customer_spend, exclude_cancelled defaults to true unless caller specifies false.
  // For count_orders and count_by_status, exclude_cancelled defaults to false unless caller specifies true.
  const shouldExcludeCancelled =
    typeof exclude_cancelled === 'boolean'
      ? exclude_cancelled
      : metric === 'sum_revenue' || metric === 'top_customer_spend';

  // Apply filters
  const filteredOrders = allOrders.filter((order) => {
    // Cancellation exclusion
    if (shouldExcludeCancelled && order.status.toLowerCase() === 'cancelled') {
      return false;
    }

    // Status filter
    if (status && order.status.toLowerCase() !== status.toLowerCase()) {
      return false;
    }

    // Category filter (case-insensitive substring/equality)
    if (category && !order.category.toLowerCase().includes(category.toLowerCase())) {
      return false;
    }

    // City filter (case-insensitive)
    if (city && !order.city.toLowerCase().includes(city.toLowerCase())) {
      return false;
    }

    // Year filter
    if (year) {
      const orderYear = parseInt(order.order_date.split('-')[0], 10);
      if (orderYear !== year) return false;
    }

    // Month filter
    if (month) {
      const orderMonth = parseInt(order.order_date.split('-')[1], 10);
      if (orderMonth !== month) return false;
    }

    // Date range filters (inclusive)
    if (start_date && order.order_date < start_date) {
      return false;
    }
    if (end_date && order.order_date > end_date) {
      return false;
    }

    return true;
  });

  const metadata = {
    metric,
    filters_applied: {
      category: category || null,
      status: status || null,
      city: city || null,
      month: month || null,
      year: year || null,
      date_range: start_date || end_date ? `${start_date || 'beginning'} to ${end_date || 'end'}` : null,
      cancelled_orders_excluded: shouldExcludeCancelled,
      returned_orders_included: !status || status.toLowerCase() === 'returned',
    },
    matching_orders_count: filteredOrders.length,
  };

  switch (metric) {
    case 'count_orders': {
      return {
        success: true,
        ...metadata,
        count: filteredOrders.length,
        explanation: `Found ${filteredOrders.length} orders matching criteria.`,
      };
    }

    case 'count_by_status': {
      const counts = {
        delivered: 0,
        cancelled: 0,
        returned: 0,
        processing: 0,
        shipped: 0,
      };
      for (const o of filteredOrders) {
        const s = o.status.toLowerCase();
        counts[s] = (counts[s] || 0) + 1;
      }
      return {
        success: true,
        ...metadata,
        counts_by_status: counts,
        total: filteredOrders.length,
      };
    }

    case 'sum_revenue': {
      // Deterministic sum using total_inr
      const totalRevenueInr = filteredOrders.reduce(
        (sum, order) => sum + order.total_inr,
        0
      );
      return {
        success: true,
        ...metadata,
        total_revenue_inr: totalRevenueInr,
        formatted_revenue: `₹${totalRevenueInr.toLocaleString('en-IN')}`,
        order_count: filteredOrders.length,
        convention_notes:
          'Revenue calculation excludes cancelled orders by default. Returned orders remain included.',
      };
    }

    case 'top_customer_spend': {
      const spendMap = {};
      const orderCountMap = {};

      for (const order of filteredOrders) {
        const name = order.customer_name;
        spendMap[name] = (spendMap[name] || 0) + order.total_inr;
        orderCountMap[name] = (orderCountMap[name] || 0) + 1;
      }

      const sorted = Object.entries(spendMap)
        .map(([customer_name, total_spent_inr]) => ({
          customer_name,
          total_spent_inr,
          formatted_spent: `₹${total_spent_inr.toLocaleString('en-IN')}`,
          order_count: orderCountMap[customer_name],
        }))
        .sort((a, b) => b.total_spent_inr - a.total_spent_inr);

      const topCustomer = sorted.length > 0 ? sorted[0] : null;

      return {
        success: true,
        ...metadata,
        top_customer: topCustomer,
        top_customers_ranked: sorted.slice(0, 5),
        total_unique_customers: sorted.length,
        convention_notes:
          'Customer spending calculation excludes cancelled orders by default. Returned orders remain included.',
      };
    }

    default:
      return {
        success: false,
        error: `Unsupported metric: ${metric}`,
      };
  }
}

/**
 * Allowlisted tools dictionary
 */
export const ORDER_TOOLS = {
  lookup_order,
  search_orders,
  calculate_order_metrics,
};

/**
 * Dispatcher: executes an allowlisted tool safely
 */
export function executeTool(name, args) {
  if (!Object.prototype.hasOwnProperty.call(ORDER_TOOLS, name)) {
    return {
      success: false,
      error: `Unknown tool "${name}". Allowlisted tools are: ${Object.keys(ORDER_TOOLS).join(', ')}.`,
    };
  }

  try {
    const fn = ORDER_TOOLS[name];
    return fn(args);
  } catch (err) {
    return {
      success: false,
      error: `Tool execution failed: ${err.message}`,
    };
  }
}

/**
 * Generates user-facing, sanitized, compact activity labels
 */
export function getToolLabel(name, args = {}) {
  switch (name) {
    case 'lookup_order':
      return args?.order_id
        ? `Looking up order ${String(args.order_id).toUpperCase()}`
        : 'Looking up order';

    case 'search_orders': {
      const parts = [];
      if (args?.category) parts.push(`category: ${args.category}`);
      if (args?.city) parts.push(`city: ${args.city}`);
      if (args?.status) parts.push(`status: ${args.status}`);
      if (args?.customer_name) parts.push('customer search');
      if (args?.product) parts.push(`product: ${args.product}`);
      return parts.length > 0
        ? `Searching orders (${parts.join(', ')})`
        : 'Searching orders';
    }

    case 'calculate_order_metrics': {
      const metric = args?.metric;
      if (metric === 'sum_revenue') {
        const parts = [];
        if (args?.category) parts.push(args.category);
        if (args?.month) {
          const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
          ];
          parts.push(monthNames[args.month - 1] || `Month ${args.month}`);
        }
        if (args?.year) parts.push(String(args.year));
        return parts.length > 0
          ? `Calculating revenue (${parts.join(' ')})`
          : 'Calculating total revenue';
      }
      if (metric === 'top_customer_spend') {
        return 'Analyzing top-spending customer';
      }
      if (metric === 'count_by_status') {
        return 'Calculating order status distribution';
      }
      if (metric === 'count_orders') {
        if (args?.status) {
          return `Counting ${args.status} orders`;
        }
        return 'Counting orders';
      }
      return 'Calculating order metrics';
    }

    default:
      return `Executing tool ${name}`;
  }
}

/**
 * Tool Declarations for Gemini API (Interactions API and GenerateContent)
 */
export const GEMINI_TOOL_DECLARATIONS = [
  {
    type: 'function',
    name: 'lookup_order',
    description:
      'Look up exact details for a specific order by order_id (e.g. ORD-1025). Returns all order fields if found, or structured not-found result if absent.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The unique order identifier (e.g. "ORD-1025").',
        },
      },
      required: ['order_id'],
    },
  },
  {
    type: 'function',
    name: 'search_orders',
    description:
      'Search orders with optional case-insensitive filters (order_id, customer_name, city, product, category, status, start_date, end_date, limit). Returns bounded results.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'Optional order ID substring to filter by.',
        },
        customer_name: {
          type: 'string',
          description: 'Optional customer name substring to filter by.',
        },
        city: {
          type: 'string',
          description: 'Optional city name substring to filter by.',
        },
        product: {
          type: 'string',
          description: 'Optional product name substring to filter by.',
        },
        category: {
          type: 'string',
          description: 'Optional category name (e.g. Electronics, Furniture, Stationery, Accessories).',
        },
        status: {
          type: 'string',
          description: 'Optional status: delivered, cancelled, returned, processing, shipped.',
        },
        start_date: {
          type: 'string',
          description: 'Optional inclusive start date formatted as YYYY-MM-DD.',
        },
        end_date: {
          type: 'string',
          description: 'Optional inclusive end date formatted as YYYY-MM-DD.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of orders to return (1-25, default: 10).',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'calculate_order_metrics',
    description:
      'Perform deterministic calculations on order data in JavaScript. NEVER calculate revenue or customer spend manually in the LLM. Supported metrics: count_orders, count_by_status, sum_revenue, top_customer_spend. Note: revenue and customer spend exclude cancelled orders by default; returned orders remain included.',
    parameters: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['count_orders', 'count_by_status', 'sum_revenue', 'top_customer_spend'],
          description: 'The metric calculation to perform.',
        },
        category: {
          type: 'string',
          description: 'Optional category filter (e.g. Electronics, Furniture, Stationery, Accessories).',
        },
        status: {
          type: 'string',
          description: 'Optional status filter: delivered, cancelled, returned, processing, shipped.',
        },
        city: {
          type: 'string',
          description: 'Optional city filter.',
        },
        month: {
          type: 'integer',
          description: 'Optional month number (1-12) to filter by.',
        },
        year: {
          type: 'integer',
          description: 'Optional year number (e.g. 2026) to filter by.',
        },
        start_date: {
          type: 'string',
          description: 'Optional inclusive start date formatted as YYYY-MM-DD.',
        },
        end_date: {
          type: 'string',
          description: 'Optional inclusive end date formatted as YYYY-MM-DD.',
        },
        exclude_cancelled: {
          type: 'boolean',
          description: 'Whether to exclude cancelled orders. Defaults to true for sum_revenue and top_customer_spend; defaults to false for count_orders.',
        },
      },
      required: ['metric'],
    },
  },
];
