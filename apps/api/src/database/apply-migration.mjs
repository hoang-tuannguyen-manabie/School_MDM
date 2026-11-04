import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../../');

function loadEnvValue(key) {
  if (process.env[key]) return process.env[key];
  const envPath = resolve(repoRoot, '.env');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0 && trimmed.slice(0, idx).trim() === key) {
      return trimmed.slice(idx + 1).trim();
    }
  }
  return undefined;
}

const dbUrl = loadEnvValue('DATABASE_URL');
const regions = [
  'aws-0-ap-northeast-2',
  'aws-1-ap-northeast-2',
  'aws-0-ap-northeast-1',
  'aws-1-ap-northeast-1',
  'aws-0-ap-southeast-1',
  'aws-1-ap-southeast-1',
  'aws-0-ap-southeast-2',
  'aws-0-ap-south-1',
  'aws-0-us-east-1',
  'aws-1-us-east-1',
  'aws-0-us-west-1',
  'aws-0-eu-central-1',
];

const candidateUrls = [
  ...(dbUrl
    ? regions.map((r) =>
        dbUrl.replace(/aws-\d-[a-z0-9-]+(?=\.pooler\.supabase\.com)/, r),
      )
    : []),
  loadEnvValue('DIRECT_DATABASE_URL'),
].filter(Boolean);

const migrationSql = readFileSync(
  resolve(repoRoot, 'database/migrations/202611040001_init_school_mdm/migration.sql'),
  'utf8',
);

async function main() {
  let connectedClient = null;
  let lastError = null;

  for (const connStr of candidateUrls) {
    const safeEndpoint = connStr.split('@')[1] ?? 'unknown-host';
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });

    try {
      await client.connect();
      console.log(`Connected successfully to Supabase endpoint: ${safeEndpoint}`);
      connectedClient = client;
      break;
    } catch (err) {
      lastError = err;
      console.log(`Endpoint ${safeEndpoint} failed: ${err.message}`);
    }
  }

  if (!connectedClient) {
    throw new Error(
      `Could not connect to any Supabase endpoint. Last error: ${lastError?.message}`,
    );
  }

  try {
    const existingRes = await connectedClient.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    const existingTables = existingRes.rows.map((r) => r.tablename);
    console.log(
      `Existing public tables before migration (${existingTables.length}):`,
      existingTables,
    );

    if (!existingTables.includes('users')) {
      console.log('Applying migration 202611040001_init_school_mdm/migration.sql...');
      await connectedClient.query(migrationSql);
      console.log('Migration applied successfully!');
    } else {
      console.log('Core tables already exist in public schema; skipping DDL execution.');
    }

    await connectedClient.query(`
      INSERT INTO "roles" ("code", "name", "description")
      VALUES
        ('ADMIN', 'Quản trị viên hệ thống', 'Toàn quyền quản trị hệ thống School MDM Portal'),
        ('TEACHER', 'Giáo viên đứng lớp', 'Quản lý phiên học và thiết bị trong phạm vi lớp được phân công')
      ON CONFLICT ("code") DO NOTHING;
    `);

    await connectedClient.query(`
      INSERT INTO "mdm_providers" ("code", "name", "provider_type", "base_url", "provider_version", "is_active", "is_default")
      VALUES
        ('classroom-dpc-local', 'Classroom DPC Gateway (0 đồng - LAN)', 'CLASSROOM_DPC', 'https://mdm.school.local', 'classroom-dpc-1.0.0', true, true),
        ('headwind-community-local', 'Headwind MDM Community', 'HEADWIND_COMMUNITY', 'http://localhost:18080', 'community-baseline', true, false)
      ON CONFLICT ("code") DO NOTHING;
    `);

    const finalRes = await connectedClient.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    const finalTables = finalRes.rows.map((r) => r.tablename);
    console.log(`Total public tables after migration (${finalTables.length}):`, finalTables);
  } finally {
    await connectedClient.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
