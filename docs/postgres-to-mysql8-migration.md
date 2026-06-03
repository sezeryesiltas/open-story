# PostgreSQL -> MySQL 8 export utility

This repository includes a credential-free helper that exports PostgreSQL tables into a MySQL 8 friendly bundle:

- `scripts/postgres-to-mysql8-export.js`

The script does **not** embed credentials. It reads connection settings from environment variables or CLI flags.

## What it produces

Default output directory: `tmp/mysql8-export`

Files:

- `mysql-schema.sql` — generated MySQL 8 DDL
- `mysql-import.sql` — `LOAD DATA LOCAL INFILE` import script
- `manifest.json` — exported table manifest and type mapping
- `csv/<table>.csv` — one CSV per PostgreSQL table
- `README.md` — import instructions summary

## PostgreSQL client requirement

This utility shells out to the PostgreSQL CLI client `psql`. If `psql` is not on your `PATH`, set one of:

- `PSQL_BIN=/full/path/to/psql`
- `PG_BIN_DIR=/directory/that/contains/psql`

Example on macOS with Homebrew:

```bash
export PSQL_BIN="/opt/homebrew/bin/psql"
```

## Required environment variables

PostgreSQL source:

- `PGHOST`
- `PGPORT` (optional, default `5432`)
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSLMODE` (optional, default `require`)

Optional export configuration:

- `PGMYSQL_SCHEMA` (default `public`)
- `PGMYSQL_OUT_DIR` (default `tmp/mysql8-export`)
- `PGMYSQL_TABLES` (comma-separated allowlist)
- `MYSQL_DATABASE` (default `open_story`)

## Example usage

```bash
PATH="$HOME/.local/bin:$PATH"
export PGHOST="your-postgres-host"
export PGPORT="5432"
export PGDATABASE="postgres"
export PGUSER="your-user"
export PGPASSWORD="your-password"
export PGSSLMODE="require"
export MYSQL_DATABASE="open_story"

node scripts/postgres-to-mysql8-export.js --out tmp/mysql8-export
```

If `psql` is not on your shell `PATH`:

```bash
PSQL_BIN="/opt/homebrew/bin/psql" node scripts/postgres-to-mysql8-export.js --out tmp/mysql8-export
```

Or with flags:

```bash
node scripts/postgres-to-mysql8-export.js \
  --host your-postgres-host \
  --port 5432 \
  --database postgres \
  --user your-user \
  --password 'your-password' \
  --sslmode require \
  --schema public \
  --mysql-database open_story \
  --out tmp/mysql8-export
```

## Import into MySQL 8

```bash
mysql --local-infile=1 -u your_mysql_user -p < tmp/mysql8-export/mysql-schema.sql
mysql --local-infile=1 -u your_mysql_user -p < tmp/mysql8-export/mysql-import.sql
```

If your MySQL server disables local infile, you may need to enable it both on the client and server side.

## Conversion rules

Current automatic mappings:

- `uuid` -> `CHAR(36)`
- `boolean` -> `TINYINT(1)`
- `integer` -> `INT`
- `bigint` -> `BIGINT`
- `numeric` -> `DECIMAL(p,s)` when precision metadata exists
- `text` -> `LONGTEXT`
- `varchar(n)` -> `VARCHAR(n)`
- `json/jsonb` -> `JSON`
- PostgreSQL arrays -> `JSON`
- `bytea` -> `LONGBLOB`
- `timestamp with time zone` -> UTC `DATETIME(6)` text during export
- PostgreSQL enum / user-defined types -> `VARCHAR(191)`

## Important limitations

Review the generated SQL before production migration. In particular:

1. PostgreSQL enums are downgraded to strings.
2. Views, triggers, stored procedures, policies, grants, RLS rules, and extensions are not migrated.
3. Expression indexes / partial indexes are not preserved.
4. Sequence semantics may differ from PostgreSQL identity/serial behavior.
5. Foreign keys are approximated from information schema and should be verified.
6. Very large tables may require chunked export instead of a single CSV.

## Suggested production process

1. Take an approved backup/snapshot first.
2. Export from a read replica if available.
3. Validate row counts per table after import.
4. Compare representative records for JSON, timestamps, booleans, and binary fields.
5. Run application smoke tests against MySQL before cutover.
6. Plan manual fixes for unsupported PostgreSQL-only features.
