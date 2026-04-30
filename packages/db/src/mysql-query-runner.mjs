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

try {
  const request = JSON.parse(await readStdin());
  const connection = await mysql.createConnection({
    host: request.config.host,
    port: request.config.port,
    user: request.config.username,
    password: request.config.password,
    database: request.config.database,
    connectTimeout: 10000,
    charset: 'utf8mb4',
  });

  try {
    const results = [];
    for (const statement of request.statements) {
      const params = statement.params ?? [];
      const [result] = params.length > 0
        ? await connection.execute(statement.sql, params)
        : await connection.query(statement.sql);
      results.push(result);
    }

    process.stdout.write(JSON.stringify({ results }, jsonReplacer));
  } finally {
    await connection.end();
  }
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
