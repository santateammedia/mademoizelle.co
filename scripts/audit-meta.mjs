import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '..');
const dirs = ['content/blog/en','content/blog/ar','content/blog/fr','content/blog'];
const rows = [];
for (const d of dirs) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith('.md')) continue;
    const fp = path.join(abs, f);
    if (fs.statSync(fp).isDirectory()) continue;
    const { data } = matter(fs.readFileSync(fp,'utf-8'));
    const t = data.title || '';
    const desc = data.description || '';
    rows.push({
      file: path.relative(ROOT, fp).replace(/\\/g, '/'),
      titleLen: [...t].length,
      descLen: [...desc].length,
      titleOver: [...t].length > 60,
      descOver: [...desc].length > 160,
    });
  }
}
rows.sort((a,b) => b.descLen - a.descLen);
for (const r of rows) {
  const flags = (r.titleOver ? 'T!' : '  ') + (r.descOver ? ' D!' : '   ');
  console.log(flags, 't=' + String(r.titleLen).padStart(3,' '), 'd=' + String(r.descLen).padStart(3,' '), r.file);
}
