import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://scheduler:scheduler_dev_password@localhost:5432/reachinbox',
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT tenant_id FROM emails LIMIT 1');
  console.log('REAL TENANT ID:', res.rows[0]?.tenant_id);
  await client.end();
}

run().catch(console.error);
