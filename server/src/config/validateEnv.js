import { env } from './env.js';

const VALID_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error', 'silent']);

function validUrl(value, { httpsOnly = false } = {}) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (httpsOnly && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function validateEnvironment() {
  const errors = [];
  const warnings = [];

  if (!Number.isInteger(env.port) || env.port <= 0 || env.port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535.');
  }

  if (!VALID_LOG_LEVELS.has(String(env.logLevel).toLowerCase())) {
    warnings.push('LOG_LEVEL is not recognized; the server will use info.');
  }

  if (!env.rateLimitEnabled) {
    warnings.push('RATE_LIMIT_ENABLED is false; public endpoints are not throttled.');
  }

  if (env.strictProduction) {
    if (!env.mongoUri) {
      if (env.allowMemoryDb) {
        warnings.push(
          'MONGODB_URI is missing and ALLOW_MEMORY_DB is enabled; data will be lost on restart.'
        );
      } else {
        errors.push('MONGODB_URI is required in production.');
      }
    } else if (!/^mongodb(\+srv)?:\/\//.test(env.mongoUri)) {
      errors.push('MONGODB_URI must use mongodb:// or mongodb+srv://.');
    }

    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      errors.push(
        'SUPABASE_URL and SUPABASE_ANON_KEY are required in production.'
      );
    } else if (
      env.supabaseUrl.includes('your-project-id') ||
      env.supabaseAnonKey.includes('your-supabase-anon-key')
    ) {
      errors.push('SUPABASE_URL and SUPABASE_ANON_KEY must not use placeholders.');
    } else if (!validUrl(env.supabaseUrl, { httpsOnly: true })) {
      errors.push('SUPABASE_URL must be a valid HTTPS URL.');
    }

    if (env.allowDemoAuth) {
      errors.push('ALLOW_DEMO_AUTH must not be enabled in production.');
    }

    if (!env.corsConfigured) {
      errors.push('CLIENT_URL or CORS_ORIGINS must be set in production.');
    }

    const clientOrigin = validUrl(env.clientUrl, { httpsOnly: true });
    if (!clientOrigin) {
      errors.push('CLIENT_URL must be a valid HTTPS URL in production.');
    } else if (!env.allowedOrigins.includes(clientOrigin.origin)) {
      errors.push('CLIENT_URL must be included in CORS_ORIGINS.');
    }

    for (const origin of env.allowedOrigins) {
      const parsed = validUrl(origin, { httpsOnly: true });
      if (!parsed) {
        errors.push(`CORS origin must be a valid HTTPS URL: ${origin}`);
      } else if (parsed.origin !== origin) {
        errors.push(`CORS origins must not include a path: ${origin}`);
      }
    }

    if (env.trustProxy === 'false') {
      warnings.push(
        'TRUST_PROXY=false may cause incorrect client IPs behind a load balancer and break rate limiting.'
      );
    }

    if (env.isVercel) {
      warnings.push(
        'Vercel serverless functions cannot maintain Socket.IO realtime connections; use a persistent Node host.'
      );
    }

    warnings.push(
      'Configure an error reporter through setErrorReporter() or errors will only be written to structured logs.'
    );
  }

  if (!env.groqKey) {
    warnings.push('GROQ_API_KEY is not set; triage requires GROQ_API_KEY or GEMINI_API_KEY.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
