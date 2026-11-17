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

// ── 3) محرك إزالة الخلفية داخل التطبيق: نموذج isnet_fp16 + ملفات onnxruntime ──
try {
  // حزمة البيانات المطابقة لإصدار المكتبة تُستضاف عند IMG.LY (npm فيها إصدار قديم فقط)
  const ver = JSON.parse(readFileSync('node_modules/@imgly/background-removal/package.json', 'utf8')).version;
  const tmp = '/tmp/imgly-data';
  if (existsSync(tmp)) rmSync(tmp, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  execSync(`curl -fsSL --retry 3 "https://staticimgly.com/@imgly/background-removal-data/${ver}/package.tgz" -o ${tmp}/data.tgz`, { stdio: 'inherit' });
  execSync(`tar -xzf ${tmp}/data.tgz -C ${tmp}`, { stdio: 'inherit' });
  const dist = `${tmp}/package/dist`;
  console.log('imgly data version', ver);
  const res = JSON.parse(readFileSync(path.join(dist, 'resources.json'), 'utf8'));
  const keep = {};
  for (const [key, val] of Object.entries(res)) {
    if (key === '/models/isnet_fp16' || key.startsWith('/onnxruntime-web/')) keep[key] = val;
  }
  const imglyDir = `${out}/imgly`;
  if (existsSync(imglyDir)) rmSync(imglyDir, { recursive: true });
  mkdirSync(imglyDir, { recursive: true });
  let copied = 0, bytes = 0;
  const copyRef = (v) => {
    if (typeof v === 'string' && v.length > 8 && existsSync(path.join(dist, v)) && !v.includes('/')) {
      copyFileSync(path.join(dist, v), path.join(imglyDir, v));
      copied++;
      bytes += readFileSync(path.join(dist, v)).length;
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(copyRef);
    }
  };
  copyRef(keep);
  writeFileSync(path.join(imglyDir, 'resources.json'), JSON.stringify(keep));
  console.log(`✓ background-removal engine bundled: ${copied} files, ${(bytes / 1048576).toFixed(1)} MB`);
} catch (e) {
  console.warn('⚠ تعذّر دمج محرك القص — سيُنزَّل من الإنترنت عند أول استخدام:', e.message);
}

// ── 4) مكتبة إزالة الخلفية ──
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
