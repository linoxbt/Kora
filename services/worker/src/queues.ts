import { setTimeout } from 'node:timers/promises';
// Independent loops keep slow webhook IO from blocking payment/status recovery.
// On shutdown/error, finish the in-flight tasks before closing their database pool.
export async function runQueues(
  jobs: (() => Promise<boolean>)[],
  active: () => boolean,
  stop: () => void,
) {
  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      try {
        while (active()) {
          const worked = await job();
          if (!worked && active()) await setTimeout(250);
        }
      } catch (error) {
        stop();
        throw error;
      }
    }),
  );
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}
