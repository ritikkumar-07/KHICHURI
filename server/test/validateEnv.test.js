import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const moduleUrl = new URL('../src/config/validateEnv.js', import.meta.url).href;
const serverRoot = fileURLToPath(new URL('../', import.meta.url));

const script = `
import { validateEnvironment } from ${JSON.stringify(moduleUrl)};
process.stdout.write(JSON.stringify(validateEnvironment()));
`;

function validate(overrides) {
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        LOG_LEVEL: 'silent',
        MONGODB_URI: '',
        SUPABASE_URL: '',
        SUPABASE_ANON_KEY: '',
        CLIENT_URL: '',
        CORS_ORIGINS: '',
        ALLOW_DEMO_AUTH: 'false',
        ALLOW_MEMORY_DB: 'false',
        ...overrides,
      },
      encoding: 'utf8',
    }
  );

  return JSON.parse(output);
}

test('production validation rejects missing database, auth, and HTTPS origins', () => {
  const result = validate({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('MONGODB_URI')));
  assert.ok(result.errors.some((error) => error.includes('SUPABASE_URL')));
  assert.ok(result.errors.some((error) => error.includes('CLIENT_URL')));
});

test('production validation accepts complete configuration', () => {
  const result = validate({
    MONGODB_URI: 'mongodb://127.0.0.1:27017/sanjeevani',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key-not-a-placeholder',
    CLIENT_URL: 'https://app.example.com',
    CORS_ORIGINS: 'https://app.example.com',
    TRUST_PROXY: '1',
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('production validation rejects demo auth even with complete configuration', () => {
  const result = validate({
    MONGODB_URI: 'mongodb://127.0.0.1:27017/sanjeevani',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key-not-a-placeholder',
    CLIENT_URL: 'https://app.example.com',
    CORS_ORIGINS: 'https://app.example.com',
    TRUST_PROXY: '1',
    ALLOW_DEMO_AUTH: 'true',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('ALLOW_DEMO_AUTH')));
});
