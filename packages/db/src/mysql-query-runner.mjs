import mysql from 'mysql2/promise';
import { Connector } from '@google-cloud/cloud-sql-connector';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function normalizeParam(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
    ? new Date(value)
    : value;
}

function inferInstanceConnectionName(socketPath) {
  return typeof socketPath === 'string' && socketPath.startsWith('/cloudsql/')
    ? socketPath.slice('/cloudsql/'.length)
    : null;
}

function shouldUseConnectorFallback(error, config) {
  return Boolean(
    config.socketPath &&
    inferInstanceConnectionName(config.socketPath) &&
    (error?.code === 'ECONNREFUSED' || String(error?.message ?? '').includes('ECONNREFUSED')),
  );
}

async function createDirectConnection(config) {
  return mysql.createConnection({
    host: config.socketPath ? undefined : config.host,
    port: config.port,
    socketPath: config.socketPath || undefined,
    user: config.username,
    password: config.password,
    database: config.database,
    connectTimeout: 10000,
    timezone: 'Z',
    ssl: config.sslMode === 'require' ? {} : undefined,
  });
}

async function createConnectorConnection(config, fallbackFromError = null) {
  const connector = new Connector();
  const instanceConnectionName = config.instanceConnectionName || inferInstanceConnectionName(config.socketPath);

  try {
    const connectorOptions = await connector.getOptions({
      instanceConnectionName,
      ipType: config.ipType || 'PUBLIC',
    });
    const connection = await mysql.createConnection({
      ...connectorOptions,
      user: config.username,
      password: config.password,
      database: config.database,
      connectTimeout: 10000,
      timezone: 'Z',
    });
    return { connection, connector };
  } catch (error) {
    connector.close();
    if (fallbackFromError) {
      throw new Error(
        `Unix socket connection failed (${fallbackFromError.message}). Cloud SQL Connector fallback failed (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
    throw error;
  }
}

async function createConfiguredConnection(config) {
  if (config.instanceConnectionName) {
    return createConnectorConnection(config);
  }

  try {
    return { connection: await createDirectConnection(config), connector: null };
  } catch (error) {
    if (!shouldUseConnectorFallback(error, config)) {
      throw error;
    }
    return createConnectorConnection(config, error);
  }
}

try {
  const request = JSON.parse(await readStdin());
  const { connection, connector } = await createConfiguredConnection(request.config);

  try {
    const results = [];
    for (const statement of request.statements) {
      const [rows] = await connection.execute(statement.sql, (statement.params ?? []).map(normalizeParam));
      results.push(Array.isArray(rows) ? rows : { affectedRows: rows.affectedRows });
    }

    process.stdout.write(JSON.stringify({ results }, jsonReplacer));
  } finally {
    await connection.end();
    connector?.close();
  }
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
