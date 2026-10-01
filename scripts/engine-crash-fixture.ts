import { runOnce } from '../services/worker/src/worker.js';
import { pool } from '../packages/database/src/index.js';
const [intentId,point]=process.argv.slice(2);
await runOnce({onlyIntent:intentId,leaseMs:1,checkpoint:async checkpoint=>{if(checkpoint===point)process.exit(73);}});
await pool.end();process.exit(74);
