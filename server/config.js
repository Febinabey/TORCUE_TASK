import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from .env
dotenv.config({ path: path.join(projectRoot, '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATA_FILE_PATH: z.string().default('data/orders.csv'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[Orderly AI] Environment configuration error:', parsedEnv.error.format());
  process.exit(1);
}

const env = parsedEnv.data;

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  projectRoot,
  dataFilePath: path.isAbsolute(env.DATA_FILE_PATH)
    ? env.DATA_FILE_PATH
    : path.resolve(projectRoot, env.DATA_FILE_PATH),
  gemini: {
    apiKey: env.GEMINI_API_KEY || null,
    model: env.GEMINI_MODEL,
  },
};
