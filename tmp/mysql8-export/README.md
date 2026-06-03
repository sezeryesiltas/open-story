# PostgreSQL -> MySQL 8 export bundle

Generated at: 2026-06-02T12:54:55.477Z

Contents:
- mysql-schema.sql: MySQL 8 DDL approximation
- mysql-import.sql: LOAD DATA LOCAL INFILE script
- manifest.json: table/column/type manifest
- csv/*.csv: table data exported from PostgreSQL

## Import

1. Create schema and tables:
   mysql --local-infile=1 -u <user> -p < mysql-schema.sql
2. Load CSV data:
   mysql --local-infile=1 -u <user> -p < mysql-import.sql

## Notes

- timestamp with time zone values are normalized to UTC text before import.
- PostgreSQL arrays are serialized as JSON text.
- json/jsonb columns are emitted as JSON strings suitable for MySQL JSON columns.
- enum/user-defined PostgreSQL types are downgraded to VARCHAR(191) by default.
- Review foreign keys, indexes, generated columns, views, triggers, and sequences manually before production cutover.
