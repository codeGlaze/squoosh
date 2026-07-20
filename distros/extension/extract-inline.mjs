import { readFileSync, writeFileSync } from 'fs';
const f = process.argv[2];
let html = readFileSync(f, 'utf8');
// Match the one inline <script>...</script> that has no src attribute.
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.log('no inline script found'); process.exit(0); }
writeFileSync(f.replace(/index\.html$/, 'bootstrap.js'), m[1]);
html = html.replace(m[0], '<script src="bootstrap.js"></script>');
writeFileSync(f, html);
console.log('externalized inline script -> bootstrap.js');
