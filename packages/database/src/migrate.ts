import { readFile, readdir } from 'node:fs/promises';
import { pool, transaction } from './index.js';
const directory = new URL('../migrations/', import.meta.url);
const files = (await readdir(directory)).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
await transaction(async c => {
  await c.query('SELECT pg_advisory_xact_lock(742091)');
  await c.query('CREATE TABLE IF NOT EXISTS migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const file of files) {
    const version = file.split('_')[0];
    if (!(await c.query('SELECT 1 FROM migrations WHERE version=$1', [version])).rowCount) {
      await c.query(await readFile(new URL(file, directory), 'utf8'));
      await c.query('INSERT INTO migrations(version) VALUES($1)', [version]);
    }
  }
});
console.log('Kora database ready');
await pool.end();
