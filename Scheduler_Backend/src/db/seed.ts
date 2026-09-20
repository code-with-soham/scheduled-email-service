import fs from 'node:fs';
import path from 'node:path';
import { pool } from './pool';
import { senderConfigs, senderTenantAssignments } from '../config/env';

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);

  for (const sender of senderConfigs) {
    await pool.query(
      `INSERT INTO senders (id, name, email, host, port, username, password, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name,
         email=EXCLUDED.email,
         host=EXCLUDED.host,
         port=EXCLUDED.port,
         username=EXCLUDED.username,
         password=EXCLUDED.password,
         enabled=TRUE,
         updated_at=NOW()`,
      [sender.id, sender.name, sender.email, sender.host, sender.port, sender.user, sender.pass]
    );
  }

  for (const assignment of senderTenantAssignments) {
    await pool.query(
      `INSERT INTO sender_tenants (sender_id, tenant_id) VALUES ($1, $2)
       ON CONFLICT (sender_id, tenant_id) DO NOTHING`,
      [assignment.senderId, assignment.tenantId]
    );
  }

  console.log(`Database initialized. Upserted ${senderConfigs.length} sender(s) and ${senderTenantAssignments.length} assignment(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
