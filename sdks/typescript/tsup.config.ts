import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['sdks/typescript/src/index.ts', 'sdks/typescript/src/webhooks.ts'],
  outDir: 'sdks/typescript/dist',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
});
