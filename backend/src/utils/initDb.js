// Bootstraps the database from schema.sql + seed.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  const seed   = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'seed.sql'), 'utf8');

  console.log('Applying schema...');
  await conn.query(schema);
  console.log('Seeding sample data...');
  await conn.query(seed);

  // Re-hash the demo password to guarantee it matches "password123"
  const dbName = process.env.DB_NAME || 'appointment_app';
  const hash = await bcrypt.hash('password123', 10);
  await conn.query(`UPDATE \`${dbName}\`.users SET password_hash=? WHERE email IN
    ('admin@app.com','organiser@app.com','customer@app.com','watson@app.com')`, [hash]);

  console.log('Database ready. Demo password for all seed users: "password123"');
  await conn.end();
})().catch((e) => {
  console.error('initDb failed:', e.message);
  process.exit(1);
});
