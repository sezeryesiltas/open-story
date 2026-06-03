#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const psqlBinary = process.env.PSQL_BIN || (process.env.PG_BIN_DIR ? path.join(process.env.PG_BIN_DIR, 'psql') : 'psql');

function log(msg) {
  process.stdout.write(`[pg->mysql8] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[pg->mysql8] ERROR: ${msg}\n`);
  process.exit(1);
}

function env(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv);
const outDir = path.resolve(args.out || env('PGMYSQL_OUT_DIR', 'tmp/mysql8-export'));
const schemaName = args.schema || env('PGMYSQL_SCHEMA', 'public');
const host = args.host || env('PGHOST');
const port = String(args.port || env('PGPORT', '5432'));
const database = args.database || env('PGDATABASE');
const user = args.user || env('PGUSER');
const password = args.password || env('PGPASSWORD');
const sslmode = args.sslmode || env('PGSSLMODE', 'require');
const mysqlDatabase = args['mysql-database'] || env('MYSQL_DATABASE', 'open_story');
const includeTablesRaw = args.tables || env('PGMYSQL_TABLES', '');
const includeTables = includeTablesRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!host || !database || !user || !password) {
  fail('Missing required Postgres connection vars. Set PGHOST, PGDATABASE, PGUSER, PGPASSWORD (and optionally PGPORT, PGSSLMODE).');
}

const psqlEnv = {
  ...process.env,
  PGHOST: host,
  PGPORT: port,
  PGDATABASE: database,
  PGUSER: user,
  PGPASSWORD: password,
  PGSSLMODE: sslmode,
};

function runPsql(sql, options = {}) {
  const result = spawnSync(psqlBinary, [
    '-X',
    '-v', 'ON_ERROR_STOP=1',
    '-qAt',
    '-c', sql,
  ], {
    env: psqlEnv,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
    ...options,
  });

  if (result.error) {
    fail(`Failed to execute ${psqlBinary}: ${result.error.message}. Install PostgreSQL client tools or set PSQL_BIN=/full/path/to/psql (or PG_BIN_DIR=/dir/containing/psql).`);
  }
  if (result.status !== 0) {
    fail((result.stderr || 'psql exited with non-zero status').trim());
  }
  return result.stdout;
}

function quotePgLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quotePgIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function mysqlIdent(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

function normalizeDefault(expr) {
  if (!expr) return null;
  const raw = expr.trim();
  if (/^nextval\(/i.test(raw)) return null;
  if (/^CURRENT_TIMESTAMP$/i.test(raw)) return 'CURRENT_TIMESTAMP';
  if (/^now\(\)$/i.test(raw)) return 'CURRENT_TIMESTAMP';
  if (/^true$/i.test(raw)) return '1';
  if (/^false$/i.test(raw)) return '0';
  if (/^NULL$/i.test(raw)) return null;
  if (/^'(.*)'::/i.test(raw)) {
    const m = raw.match(/^'(.*)'::/i);
    return `'${m[1].replace(/'/g, "''")}'`;
  }
  if (/^'(.*)'$/s.test(raw)) return raw;
  if (/^-?\d+(\.\d+)?$/i.test(raw)) return raw;
  return null;
}

function mapType(column) {
  const udt = column.udt_name;
  const dataType = column.data_type;

  if (column.is_identity === 'YES') return 'BIGINT';
  if (dataType === 'uuid') return 'CHAR(36)';
  if (dataType === 'boolean') return 'TINYINT(1)';
  if (dataType === 'smallint') return 'SMALLINT';
  if (dataType === 'integer') return 'INT';
  if (dataType === 'bigint') return 'BIGINT';
  if (dataType === 'real') return 'FLOAT';
  if (dataType === 'double precision') return 'DOUBLE';
  if (dataType === 'numeric') {
    if (column.numeric_precision && column.numeric_scale !== null) {
      return `DECIMAL(${column.numeric_precision},${column.numeric_scale})`;
    }
    return 'DECIMAL(65,30)';
  }
  if (dataType === 'character varying') {
    return column.character_maximum_length ? `VARCHAR(${column.character_maximum_length})` : 'LONGTEXT';
  }
  if (dataType === 'character') {
    return column.character_maximum_length ? `CHAR(${column.character_maximum_length})` : 'CHAR(1)';
  }
  if (dataType === 'text') return 'LONGTEXT';
  if (dataType === 'date') return 'DATE';
  if (dataType === 'time without time zone') return 'TIME';
  if (dataType === 'timestamp without time zone') return 'DATETIME(6)';
  if (dataType === 'timestamp with time zone') return 'DATETIME(6)';
  if (dataType === 'json' || dataType === 'jsonb') return 'JSON';
  if (dataType === 'bytea') return 'LONGBLOB';
  if (dataType === 'ARRAY' || (udt && udt.startsWith('_'))) return 'JSON';
  if (dataType === 'USER-DEFINED') return 'VARCHAR(191)';
  return 'LONGTEXT';
}

function convertValueExpr(column) {
  const col = quotePgIdent(column.column_name);
  const dataType = column.data_type;
  const udt = column.udt_name;

  if (dataType === 'boolean') return `CASE WHEN ${col} IS NULL THEN '' WHEN ${col} THEN '1' ELSE '0' END`;
  if (dataType === 'json' || dataType === 'jsonb') return `COALESCE(${col}::text, '')`;
  if (dataType === 'timestamp with time zone') return `COALESCE(to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US'), '')`;
  if (dataType === 'timestamp without time zone') return `COALESCE(to_char(${col}, 'YYYY-MM-DD HH24:MI:SS.US'), '')`;
  if (dataType === 'date') return `COALESCE(to_char(${col}, 'YYYY-MM-DD'), '')`;
  if (dataType === 'time without time zone') return `COALESCE(to_char(${col}, 'HH24:MI:SS.US'), '')`;
  if (dataType === 'bytea') return `COALESCE(encode(${col}, 'hex'), '')`;
  if (dataType === 'ARRAY' || (udt && udt.startsWith('_'))) return `COALESCE(array_to_json(${col})::text, '')`;
  return `COALESCE(${col}::text, '')`;
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'csv'), { recursive: true });

log(`Reading table list from schema ${schemaName}...`);
const tableSql = `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = ${quotePgLiteral(schemaName)}
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
`;

let tables = runPsql(tableSql)
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

if (includeTables.length > 0) {
  const allow = new Set(includeTables);
  tables = tables.filter((table) => allow.has(table));
}

if (tables.length === 0) {
  fail(`No tables found in schema ${schemaName}.`);
}

log(`Found ${tables.length} table(s): ${tables.join(', ')}`);

const manifest = {
  generatedAt: new Date().toISOString(),
  postgres: { host, port, database, schema: schemaName, sslmode },
  mysql: { database: mysqlDatabase },
  tables: [],
};

const ddlParts = [];
const importParts = [];

ddlParts.push('-- Generated by scripts/postgres-to-mysql8-export.js');
ddlParts.push(`CREATE DATABASE IF NOT EXISTS ${mysqlIdent(mysqlDatabase)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
ddlParts.push(`USE ${mysqlIdent(mysqlDatabase)};`);
ddlParts.push('SET NAMES utf8mb4;');
ddlParts.push('SET FOREIGN_KEY_CHECKS=0;');

importParts.push('-- Generated MySQL 8 import helper');
importParts.push(`USE ${mysqlIdent(mysqlDatabase)};`);
importParts.push('SET NAMES utf8mb4;');
importParts.push('SET FOREIGN_KEY_CHECKS=0;');

for (const table of tables) {
  log(`Inspecting ${table}...`);
  const columnSql = `
SELECT
  c.column_name,
  c.ordinal_position,
  c.is_nullable,
  c.data_type,
  c.udt_name,
  c.column_default,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.datetime_precision,
  c.is_identity
FROM information_schema.columns c
WHERE c.table_schema = ${quotePgLiteral(schemaName)}
  AND c.table_name = ${quotePgLiteral(table)}
ORDER BY c.ordinal_position;
`;

  const pkSql = `
SELECT kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = ${quotePgLiteral(schemaName)}
  AND tc.table_name = ${quotePgLiteral(table)}
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY kcu.ordinal_position;
`;

  const fkSql = `
SELECT
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = ${quotePgLiteral(schemaName)}
  AND tc.table_name = ${quotePgLiteral(table)}
ORDER BY kcu.ordinal_position;
`;

  const columns = runPsql(columnSql)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [column_name, ordinal_position, is_nullable, data_type, udt_name, column_default, character_maximum_length, numeric_precision, numeric_scale, datetime_precision, is_identity] = line.split('|');
      return {
        column_name,
        ordinal_position: Number(ordinal_position),
        is_nullable,
        data_type,
        udt_name,
        column_default: column_default || null,
        character_maximum_length: character_maximum_length ? Number(character_maximum_length) : null,
        numeric_precision: numeric_precision ? Number(numeric_precision) : null,
        numeric_scale: numeric_scale ? Number(numeric_scale) : null,
        datetime_precision: datetime_precision ? Number(datetime_precision) : null,
        is_identity,
      };
    });

  const primaryKeys = runPsql(pkSql)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const foreignKeys = runPsql(fkSql)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [column_name, foreign_table_name, foreign_column_name] = line.split('|');
      return { column_name, foreign_table_name, foreign_column_name };
    });

  const createLines = [];
  for (const column of columns) {
    const mysqlType = mapType(column);
    const nullable = column.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultValue = normalizeDefault(column.column_default);
    const autoIncrement = column.is_identity === 'YES' ? ' AUTO_INCREMENT' : '';
    const defaultClause = defaultValue !== null ? ` DEFAULT ${defaultValue}` : '';
    createLines.push(`  ${mysqlIdent(column.column_name)} ${mysqlType} ${nullable}${defaultClause}${autoIncrement}`);
  }

  if (primaryKeys.length > 0) {
    createLines.push(`  PRIMARY KEY (${primaryKeys.map(mysqlIdent).join(', ')})`);
  }

  for (const fk of foreignKeys) {
    createLines.push(
      `  KEY ${mysqlIdent(`idx_${table}_${fk.column_name}`)} (${mysqlIdent(fk.column_name)}),\n  CONSTRAINT ${mysqlIdent(`fk_${table}_${fk.column_name}`)} FOREIGN KEY (${mysqlIdent(fk.column_name)}) REFERENCES ${mysqlIdent(fk.foreign_table_name)} (${mysqlIdent(fk.foreign_column_name)})`
    );
  }

  ddlParts.push(`DROP TABLE IF EXISTS ${mysqlIdent(table)};`);
  ddlParts.push(`CREATE TABLE ${mysqlIdent(table)} (\n${createLines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  const csvPath = path.join(outDir, 'csv', `${table}.csv`);
  const projections = columns.map(convertValueExpr);
  const copySql = `COPY (SELECT ${projections.join(', ')} FROM ${quotePgIdent(schemaName)}.${quotePgIdent(table)}) TO STDOUT WITH CSV HEADER`;
  const copyResult = spawnSync(psqlBinary, ['-X', '-v', 'ON_ERROR_STOP=1', '-c', copySql], {
    env: psqlEnv,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 200,
  });
  if (copyResult.error) {
    fail(`Failed to export CSV for ${table}: ${copyResult.error.message}`);
  }
  if (copyResult.status !== 0) {
    fail((copyResult.stderr || `Failed to export CSV for ${table}`).trim());
  }
  fs.writeFileSync(csvPath, copyResult.stdout, 'utf8');

  const setters = columns.map((column) => {
    const name = column.column_name;
    if (column.data_type === 'bytea') {
      return `${mysqlIdent(name)} = CASE WHEN @${name} = '' THEN NULL ELSE UNHEX(@${name}) END`;
    }
    return `${mysqlIdent(name)} = NULLIF(@${name}, '')`;
  }).join(',\n  ');

  importParts.push(`LOAD DATA LOCAL INFILE '${path.join(outDir, 'csv', `${table}.csv`).replace(/\\/g, '/')}'`);
  importParts.push(`INTO TABLE ${mysqlIdent(table)}`);
  importParts.push(`CHARACTER SET utf8mb4`);
  importParts.push(`FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '\"' ESCAPED BY '\"'`);
  importParts.push(`LINES TERMINATED BY '\\n' IGNORE 1 LINES`);
  importParts.push(`(${columns.map((c) => `@${c.column_name}`).join(', ')})`);
  importParts.push(`SET\n  ${setters};\n`);

  manifest.tables.push({
    table,
    csv: `csv/${table}.csv`,
    columns: columns.map((c) => ({
      name: c.column_name,
      postgresType: c.data_type,
      mysqlType: mapType(c),
      nullable: c.is_nullable === 'YES',
      primaryKey: primaryKeys.includes(c.column_name),
    })),
  });
}

ddlParts.push('SET FOREIGN_KEY_CHECKS=1;');
importParts.push('SET FOREIGN_KEY_CHECKS=1;');

fs.writeFileSync(path.join(outDir, 'mysql-schema.sql'), ddlParts.join('\n\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'mysql-import.sql'), importParts.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const readme = `# PostgreSQL -> MySQL 8 export bundle\n\nGenerated at: ${new Date().toISOString()}\n\nContents:\n- mysql-schema.sql: MySQL 8 DDL approximation\n- mysql-import.sql: LOAD DATA LOCAL INFILE script\n- manifest.json: table/column/type manifest\n- csv/*.csv: table data exported from PostgreSQL\n\n## Import\n\n1. Create schema and tables:\n   mysql --local-infile=1 -u <user> -p < mysql-schema.sql\n2. Load CSV data:\n   mysql --local-infile=1 -u <user> -p < mysql-import.sql\n\n## Notes\n\n- timestamp with time zone values are normalized to UTC text before import.\n- PostgreSQL arrays are serialized as JSON text.\n- json/jsonb columns are emitted as JSON strings suitable for MySQL JSON columns.\n- enum/user-defined PostgreSQL types are downgraded to VARCHAR(191) by default.\n- Review foreign keys, indexes, generated columns, views, triggers, and sequences manually before production cutover.\n`;
fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8');

log(`Done. Bundle written to ${outDir}`);
