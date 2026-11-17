// يكتب assets/version.json: رقم الإصدار + بصمة SHA-256 لكل ملف (للتحديث الصامت)
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const dir = '../app/src/main/assets';
const files = {};
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const rel = path.relative(dir, p).split(path.sep).join('/');
      if (rel === 'version.json') continue;
      files[rel] = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  }
};
walk(dir);
const version = Number(process.env.GITHUB_RUN_NUMBER || 0);
fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version, built: new Date().toISOString(), files }, null, 1));
console.log(`✓ version.json: v${version}, ${Object.keys(files).length} files`);
