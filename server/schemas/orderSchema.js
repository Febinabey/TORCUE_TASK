import { z } from 'zod';

export const ORDER_STATUSES = [
  'delivered',
  'returned',
  'cancelled',
  'processing',
  'shipped',
];

export const OrderStatusEnum = z.enum([
  'delivered',
  'returned',
  'cancelled',
  'processing',
  'shipped',
]);

export const RawOrderRowSchema = z.object({
  order_id: z.string().trim().regex(/^ORD-\d+$/, 'Invalid order_id format (expected ORD-XXXX)'),
  order_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
  customer_name: z.string().trim().min(1, 'customer_name cannot be empty'),
  city: z.string().trim().min(1, 'city cannot be empty'),
  product: z.string().trim().min(1, 'product cannot be empty'),
  category: z.string().trim().min(1, 'category cannot be empty'),
  quantity: z.preprocess(
    (val) => Number(val),
    z.number().int().positive('quantity must be a positive integer')
  ),
  unit_price_inr: z.preprocess(
    (val) => Number(val),
    z.number().nonnegative('unit_price_inr must be non-negative')
  ),
  total_inr: z.preprocess(
    (val) => Number(val),
    z.number().nonnegative('total_inr must be non-negative')
  ),
  payment_method: z.string().trim().min(1, 'payment_method cannot be empty'),
  status: OrderStatusEnum,
}).refine(
  (data) => data.quantity * data.unit_price_inr === data.total_inr,
  {
    message: 'total_inr must equal quantity * unit_price_inr',
    path: ['total_inr'],
  }
);

export const OrderListSchema = z.array(RawOrderRowSchema).superRefine((orders, ctx) => {
  const seenIds = new Set();
  orders.forEach((order, index) => {
    if (seenIds.has(order.order_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate order_id found: ${order.order_id} at row ${index + 1}`,
        path: [index, 'order_id'],
      });
    }
    seenIds.add(order.order_id);
  });
});
