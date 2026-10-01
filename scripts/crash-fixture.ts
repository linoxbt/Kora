import { FakeConnector } from '../connectors/fake/src/index.js';
import { pool } from '../packages/database/src/index.js';
const [holdId, instructionId] = process.argv.slice(2);
await new FakeConnector().payout({ instruction_id: instructionId, hold_id: holdId, asset: 'NGN', amount_minor: '400', beneficiary: 'Crash fixture' });
// Deliberately terminate after external acceptance, before local capture.
await pool.end();
process.exit(73);
