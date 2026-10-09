import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { OrderListSchema } from '../schemas/orderSchema.js';

const REQUIRED_HEADERS = [
  'order_id',
  'order_date',
  'customer_name',
  'city',
  'product',
  'category',
  'quantity',
  'unit_price_inr',
  'total_inr',
  'payment_method',
  'status',
];

let cachedOrders = null;
let cachedSummary = null;
let currentDatasetPath = null;

export function loadAndValidateOrders(filePath) {
  if (!filePath) {
    throw new Error('[Orderly AI Startup Error] Dataset path was not provided.');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[Orderly AI Startup Error] Dataset file not found at: "${filePath}". Please ensure the CSV file exists before starting the server.`
    );
  }

  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`[Orderly AI Startup Error] Failed to read dataset file at "${filePath}": ${err.message}`);
  }

  if (!fileContent.trim()) {
    throw new Error(`[Orderly AI Startup Error] Dataset file at "${filePath}" is completely empty.`);
  }

  let rawRows;
  try {
    rawRows = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new Error(`[Orderly AI Startup Error] Failed to parse CSV syntax at "${filePath}": ${err.message}`);
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error(`[Orderly AI Startup Error] Dataset at "${filePath}" contains no data rows.`);
  }

  // Header validation
  const foundHeaders = Object.keys(rawRows[0]);
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !foundHeaders.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(
      `[Orderly AI Startup Error] Invalid CSV headers in "${filePath}". Missing required columns: [${missingHeaders.join(', ')}]. Found columns: [${foundHeaders.join(', ')}]`
    );
  }

  // Schema & integrity validation with Zod
  const validationResult = OrderListSchema.safeParse(rawRows);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues
      .slice(0, 10)
      .map((issue) => `  - Row ${(issue.path[0] !== undefined ? Number(issue.path[0]) + 1 : 'N/A')} [${issue.path.slice(1).join('.')}]: ${issue.message}`)
      .join('\n');
    const totalIssues = validationResult.error.issues.length;
    const additional = totalIssues > 10 ? `\n  ... and ${totalIssues - 10} more errors.` : '';

    throw new Error(
      `[Orderly AI Startup Error] CSV data validation failed for "${filePath}" with ${totalIssues} issue(s):\n${errorDetails}${additional}`
    );
  }

  const validOrders = validationResult.data;

  // Build summary metrics
  const statusCounts = {};
  const categoryCounts = {};
  const cityCounts = {};
  const customerNames = new Set();
  const productNames = new Set();
  let totalRevenueInr = 0;
  let minDate = validOrders[0].order_date;
  let maxDate = validOrders[0].order_date;

  for (const order of validOrders) {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    categoryCounts[order.category] = (categoryCounts[order.category] || 0) + 1;
    cityCounts[order.city] = (cityCounts[order.city] || 0) + 1;
    customerNames.add(order.customer_name);
    productNames.add(order.product);
    totalRevenueInr += order.total_inr;

    if (order.order_date < minDate) minDate = order.order_date;
    if (order.order_date > maxDate) maxDate = order.order_date;
  }

  const summary = {
    totalOrders: validOrders.length,
    totalRevenueInr,
    dateRange: {
      from: minDate,
      to: maxDate,
    },
    uniqueCustomers: customerNames.size,
    uniqueProducts: productNames.size,
    uniqueCategories: Object.keys(categoryCounts).length,
    uniqueCities: Object.keys(cityCounts).length,
    statusCounts,
    categoryCounts,
    cityCounts,
  };

  cachedOrders = validOrders;
  cachedSummary = summary;
  currentDatasetPath = filePath;

  return {
    orders: validOrders,
    summary,
  };
}

export const dataService = {
  loadAndValidateOrders,
  getOrders: () => cachedOrders,
  getSummary: () => cachedSummary,
  isLoaded: () => Boolean(cachedOrders && cachedOrders.length > 0),
  getDatasetPath: () => currentDatasetPath,
  resetCache: () => {
    cachedOrders = null;
    cachedSummary = null;
    currentDatasetPath = null;
  },
};
