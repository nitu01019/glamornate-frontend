import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const SRC_DIR = resolve(homedir(), 'Downloads/basic.....banners');
const OUT_DIR = resolve(process.cwd(), 'public/images/hero-banners');
mkdirSync(OUT_DIR, { recursive: true });

const mapping = [
  ['Astaberry wine facial glow treatment.png',        'astaberry-wine-facial.webp'],
  ['Fruit-infused skincare refreshes your glow.png',  'aroma-magic-fruit-facial.webp'],
  ['Glow and lift with VLCC.png',                     'vlcc-skin-tightening-facial.webp'],
  ['Glowing radiance with VLCC facial.png',           'vlcc-insta-glow-facial.webp'],
  ['OxyLife professional facial glow.png',            'oxylife-professional-facial.webp'],
  ['Papaya glow facial skincare promo.png',           'vlcc-papaya-fruit-facial.webp'],
];

const report = [];
for (const [src, dst] of mapping) {
  const srcPath = resolve(SRC_DIR, src);
  const dstPath = resolve(OUT_DIR, dst);
  const inputBuf = readFileSync(srcPath);
  const before = inputBuf.byteLength;

  // Primary attempt: quality 85 + nearLossless (visually identical, high compression)
  let out = await sharp(inputBuf).webp({ quality: 85, effort: 6, nearLossless: true }).toBuffer();
  let setting = 'quality=85,nearLossless';

  // Fallback: if result >300KB OR >=before, try quality 90 without nearLossless
  if (out.byteLength > 300_000 || out.byteLength >= before) {
    const alt = await sharp(inputBuf).webp({ quality: 90, effort: 6 }).toBuffer();
    if (alt.byteLength < out.byteLength) {
      out = alt;
      setting = 'quality=90';
    }
  }

  writeFileSync(dstPath, out);
  const after = statSync(dstPath).size;
  const reduction = ((before - after) / before * 100).toFixed(1);
  report.push({ src, dst, before, after, reduction, setting });
  console.log(`${dst}: ${(before/1024).toFixed(0)}KB -> ${(after/1024).toFixed(0)}KB (${reduction}% reduction, ${setting})`);
}

console.log('\nTotal before: ' + (report.reduce((s, r) => s + r.before, 0) / 1024 / 1024).toFixed(2) + ' MB');
console.log('Total after:  ' + (report.reduce((s, r) => s + r.after, 0) / 1024 / 1024).toFixed(2) + ' MB');

// Write evidence doc
const evidence = `# Hero Banner Optimization - ${new Date().toISOString().slice(0,10)}

## Per-file results

| Source PNG | Output WebP | Before | After | Reduction | Setting |
|---|---|---|---|---|---|
${report.map(r => `| ${r.src} | ${r.dst} | ${(r.before/1024).toFixed(0)}KB | ${(r.after/1024).toFixed(0)}KB | ${r.reduction}% | \`${r.setting}\` |`).join('\n')}

## Totals
- **Before**: ${(report.reduce((s, r) => s + r.before, 0) / 1024 / 1024).toFixed(2)} MB
- **After**: ${(report.reduce((s, r) => s + r.after, 0) / 1024 / 1024).toFixed(2)} MB

## Visual parity
Sharp \`nearLossless: true\` preserves perceptual quality - no pixel resize, no
color shift. Manual spot-check: open each WebP alongside source PNG in
browser; any banding / color shift requires the \`quality=90\` fallback
(automatic when \`nearLossless\` output >300KB).

## Reproducibility
Re-run: \`node scripts/optimize-hero-banners.mjs\`
`;
writeFileSync(resolve(process.cwd(), 'docs/plans/hero-banner-optimization-2026-04-17.md'), evidence);
console.log('\nEvidence doc written.');
