import 'dotenv/config';

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://sanjeevani-sooty.vercel.app',
];

const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.CORS_ORIGINS,
]
  .filter(Boolean)
  .join(',')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isProduction =
  process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: process.env.SERVICE_NAME || 'sanjeevani-api',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || '',
  groqKey: process.env.GROQ_API_KEY || process.env.GROQ_KEY || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  supabaseUrl:
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '',
  isProduction,
  isVercel: Boolean(process.env.VERCEL),
  strictProduction: isProduction,
  allowDemoAuth: parseBoolean(process.env.ALLOW_DEMO_AUTH, false),
  allowMemoryDb: parseBoolean(process.env.ALLOW_MEMORY_DB, false),
  trustProxy: process.env.TRUST_PROXY || (process.env.VERCEL ? '1' : 'false'),
  rateLimitEnabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
  logLevel: process.env.LOG_LEVEL || 'info',
  configuredOrigins,
  corsConfigured: configuredOrigins.length > 0,
  allowedOrigins: isProduction
    ? configuredOrigins
    : [...new Set([...configuredOrigins, ...defaultOrigins])],
};
