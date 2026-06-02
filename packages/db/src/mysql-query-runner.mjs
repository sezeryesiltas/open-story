import mysql from 'mysql2/promise';

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

try {
  const request = JSON.parse(await readStdin());
  const connection = await mysql.createConnection({
    host: request.config.socketPath ? undefined : request.config.host,
    port: request.config.port,
    socketPath: request.config.socketPath || undefined,
    user: request.config.username,
    password: request.config.password,
    database: request.config.database,
    connectTimeout: 10000,
    timezone: 'Z',
    ssl: request.config.sslMode === 'require' ? {} : undefined,
  });

  try {
    const results = [];
    for (const statement of request.statements) {
      const [rows] = await connection.execute(statement.sql, (statement.params ?? []).map(normalizeParam));
      results.push(Array.isArray(rows) ? rows : { affectedRows: rows.affectedRows });
    }

    process.stdout.write(JSON.stringify({ results }, jsonReplacer));
  } finally {
    await connection.end();
  }
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
