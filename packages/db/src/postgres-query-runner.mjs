import pg from 'pg';

const { Client } = pg;

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

try {
  const request = JSON.parse(await readStdin());
  const client = new Client({
    host: request.config.host,
    port: request.config.port,
    user: request.config.username,
    password: request.config.password,
    database: request.config.database,
    connectionTimeoutMillis: 10000,
    ssl: request.config.sslMode === 'require' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    const results = [];
    for (const statement of request.statements) {
      const result = await client.query(statement.sql, statement.params ?? []);
      results.push(result.command === 'SELECT' ? result.rows : { rowCount: result.rowCount });
    }

    process.stdout.write(JSON.stringify({ results }, jsonReplacer));
  } finally {
    await client.end();
  }
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
