/**
 * Build client.js from the ordered source fragments.
 *
 * The client entry is a classic script that registers a module factory, so the
 * runtime artifact must stay a single file. The fragments are plain script
 * bodies that run in the factory scope, in file-name order.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'client', 'src');
const order = fs.readdirSync(src).filter((name) => name.endsWith('.js')).sort();
const headerPath = path.join(root, 'client', 'header.txt');
const footerPath = path.join(root, 'client', 'footer.txt');

const header = fs.readFileSync(headerPath, 'utf8');
const footer = fs.readFileSync(footerPath, 'utf8');
const body = order.map((name) => fs.readFileSync(path.join(src, name), 'utf8')).join('\n');
const built = header + '\n' + body + footer;
fs.writeFileSync(path.join(root, 'client.js'), built);
console.log('client.js built from', order.length, 'fragments,', built.length, 'bytes');
