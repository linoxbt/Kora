import { processIntent } from '../packages/payments/src/index.js';
import { CorridorSandboxConnector } from '../packages/network/src/index.js';
import { pool } from '../packages/database/src/index.js';
await processIntent(process.argv[2], {
  connector: new CorridorSandboxConnector({
    checkpoint: async (position) => {
      if (position === 2) process.exit(73);
    },
  }),
});
await pool.end();
process.exit(74);
