import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadAndValidateOrders, dataService } from '../../server/services/dataService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validCsvPath = path.resolve(__dirname, '../../data/orders.csv');

describe('Data Service - CSV Loading & Validation', () => {
  beforeEach(() => {
    dataService.resetCache();
  });

  it('should successfully load and validate the real orders.csv (60 rows)', () => {
    const { orders, summary } = loadAndValidateOrders(validCsvPath);

    expect(orders).toHaveLength(60);
    expect(summary.totalOrders).toBe(60);
    expect(summary.totalRevenueInr).toBeGreaterThan(0);
    expect(summary.statusCounts).toEqual(
      expect.objectContaining({
        delivered: 48,
        returned: 3,
        cancelled: 7,
        processing: 1,
        shipped: 1,
      })
    );
    expect(dataService.isLoaded()).toBe(true);
  });

  it('should throw a clear startup error when CSV file does not exist', () => {
    const missingPath = path.resolve(__dirname, '../../data/does_not_exist.csv');

    expect(() => loadAndValidateOrders(missingPath)).toThrowError(
      /Dataset file not found at/
    );
  });

  it('should throw a clear startup error when CSV headers are invalid', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orderly-test-'));
    const invalidHeaderCsv = path.join(tempDir, 'invalid_headers.csv');
    fs.writeFileSync(invalidHeaderCsv, 'bad_col1,bad_col2\nval1,val2\n');

    expect(() => loadAndValidateOrders(invalidHeaderCsv)).toThrowError(
      /Missing required columns/
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should throw a clear error when total_inr does not equal quantity * unit_price_inr', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orderly-test-'));
    const invalidDataCsv = path.join(tempDir, 'mismatch.csv');
    const header = 'order_id,order_date,customer_name,city,product,category,quantity,unit_price_inr,total_inr,payment_method,status\n';
    const badRow = 'ORD-9999,2026-06-01,Test User,Kochi,Mouse,Electronics,2,500,9999,UPI,delivered\n'; // 2 * 500 != 9999
    fs.writeFileSync(invalidDataCsv, header + badRow);

    expect(() => loadAndValidateOrders(invalidDataCsv)).toThrowError(
      /total_inr must equal quantity \* unit_price_inr/
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should throw a clear error when duplicate order IDs exist', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orderly-test-'));
    const dupCsv = path.join(tempDir, 'duplicates.csv');
    const header = 'order_id,order_date,customer_name,city,product,category,quantity,unit_price_inr,total_inr,payment_method,status\n';
    const row1 = 'ORD-1001,2026-06-01,User One,Kochi,Mouse,Electronics,1,500,500,UPI,delivered\n';
    const row2 = 'ORD-1001,2026-06-02,User Two,Pune,Mouse,Electronics,1,500,500,UPI,delivered\n';
    fs.writeFileSync(dupCsv, header + row1 + row2);

    expect(() => loadAndValidateOrders(dupCsv)).toThrowError(
      /Duplicate order_id found/
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
