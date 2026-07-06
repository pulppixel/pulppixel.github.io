import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const svg = readFileSync(fileURLToPath(new URL('./og.svg', import.meta.url)));
const out = fileURLToPath(new URL('../public/og.png', import.meta.url));
// render at 2x for crisp text, then downscale to exact 1200x630
await sharp(svg, { density: 144 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(out);
console.log('og.png written:', out);
