// يجمّع الاستوديو مع React وKonva والخطوط داخل assets — يعمل دون مواقع CDN
import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import path from 'path';

const out = '../app/src/main/assets';
const prod = { 'process.env.NODE_ENV': '"production"' };

// ── 1) الاستوديو ──
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

// ── 2) الخطوط: من fontsource، نأخذ العربي واللاتيني فقط بصيغة woff2 ──
const fonts = JSON.parse(readFileSync('fonts.json', 'utf8'));
const pkgs = fonts.map((f) => `@fontsource/${f.pkg}`);
const install = (list) => execSync(`npm install --no-save --no-audit --no-fund ${list.join(' ')}`, { stdio: 'inherit' });
try {
  install(pkgs);
} catch {
  console.warn('⚠ تثبيت جماعي فشل — نثبّت الخطوط واحداً واحداً');
  for (const p of pkgs) {
    try {
      install([p]);
    } catch {
      console.warn('⚠ خط غير متوفر:', p);
    }
  }
}

const fontDir = `${out}/fonts`;
if (existsSync(fontDir)) rmSync(fontDir, { recursive: true });
mkdirSync(fontDir, { recursive: true });
let css = '/* الخطوط العربية مدمجة داخل التطبيق */\n';
let count = 0;
for (const f of fonts) {
  const base = path.join('node_modules', '@fontsource', f.pkg);
  if (!existsSync(base)) continue;
  for (const w of f.weights) {
    const file = path.join(base, `${w}.css`);
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      const name = m[1];
      if (!/-(arabic|latin)-\d+-/.test(name)) continue;
      let body = m[2];
      const woff2 = body.match(/url\(\.\/files\/([^)]+\.woff2)\)/);
      if (!woff2) continue;
      copyFileSync(path.join(base, 'files', woff2[1]), path.join(fontDir, woff2[1]));
      body = body.replace(/src:[^;]+;/, `src: url(fonts/${woff2[1]}) format('woff2');`);
      css += `@font-face {${body}}\n`;
      count++;
    }
  }
}
writeFileSync(`${out}/fonts.css`, css);
console.log(`✓ fonts: ${count} font faces`);

// ── 3) مكتبة إزالة الخلفية ──
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
