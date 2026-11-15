// يجمّع الاستوديو مع React وKonva والخطوط داخل assets — يعمل دون مواقع CDN
import * as esbuild from 'esbuild';
import { existsSync, rmSync } from 'fs';

const out = '../app/src/main/assets';
const prod = { 'process.env.NODE_ENV': '"production"' };

if (existsSync(`${out}/fonts`)) rmSync(`${out}/fonts`, { recursive: true });

await esbuild.build({
  entryPoints: ['src/app.jsx'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile: `${out}/app.js`,
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: true,
  define: prod,
  logLevel: 'info',
});

await esbuild.build({
  entryPoints: ['src/fonts.css'],
  bundle: true,
  outfile: `${out}/fonts.css`,
  loader: { '.woff2': 'file', '.woff': 'file' },
  assetNames: 'fonts/[name]-[hash]',
  logLevel: 'info',
});

try {
  await esbuild.build({
    entryPoints: ['src/imgly-entry.js'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    outfile: `${out}/imgly.js`,
    minify: true,
    define: prod,
    loader: { '.wasm': 'file' },
    logLevel: 'warning',
  });
  console.log('✓ imgly bundled locally');
} catch (e) {
  console.warn('⚠ imgly bundle failed — the app will load it from CDN instead:', e.message);
}
