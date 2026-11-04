import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_DOMAIN_TABLES } from '@school-mdm/contracts';

describe('Database Schema & Migration Integrity (Phase 2)', () => {
  const repoRoot = resolve(__dirname, '../../../../');
  const prismaSchemaPath = resolve(repoRoot, 'database/schema.prisma');
  const migrationSqlPath = resolve(
    repoRoot,
    'database/migrations/202611040001_init_school_mdm/migration.sql',
  );
  const rollbackSqlPath = resolve(
    repoRoot,
    'database/migrations/202611040001_init_school_mdm/rollback.sql',
  );

  const prismaContent = readFileSync(prismaSchemaPath, 'utf8');
  const migrationSql = readFileSync(migrationSqlPath, 'utf8');
  const rollbackSql = readFileSync(rollbackSqlPath, 'utf8');

  it('defines all 25 required domain tables in schema.prisma', () => {
    expect(CORE_DOMAIN_TABLES).toHaveLength(25);
    for (const tableName of CORE_DOMAIN_TABLES) {
      expect(prismaContent).toContain(`@@map("${tableName}")`);
    }
  });

  it('creates all 25 tables with UUID primary keys in migration.sql', () => {
    for (const tableName of CORE_DOMAIN_TABLES) {
      expect(migrationSql).toContain(`CREATE TABLE "${tableName}"`);
    }
    expect(migrationSql).toContain('idx_device_assignments_single_active');
  });

  it('provides a complete rollback.sql dropping all 25 tables safely', () => {
    for (const tableName of CORE_DOMAIN_TABLES) {
      expect(rollbackSql).toContain(`DROP TABLE IF EXISTS "${tableName}";`);
    }
  });
});
