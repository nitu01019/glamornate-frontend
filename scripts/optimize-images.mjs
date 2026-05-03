import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const IMAGES_DIR = path.resolve("public/images");

const RESIZE_RULES = [
  {
    match: (rel) => rel.startsWith("categories/"),
    width: 400,
    height: 400,
    quality: 75,
    label: "category thumbnail",
  },
  {
    match: (rel) =>
      /^services\/(waxing|facials|threading|bleach|hair)\//.test(rel),
    width: 600,
    height: 600,
    quality: 80,
    label: "service sub-category",
  },
  {
    match: (rel) =>
      rel.startsWith("services/") &&
      !rel.includes("/", "services/".length),
    width: 600,
    height: 450,
    quality: 80,
    label: "service root",
  },
  {
    match: (rel) => rel.startsWith("hero/"),
    width: 1200,
    height: 800,
    quality: 85,
    label: "hero banner",
  },
  {
    match: (rel) => rel.startsWith("deals/"),
    width: 800,
    height: 600,
    quality: 80,
    label: "deal card",
  },
];

async function collectJpgFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectJpgFiles(fullPath);
      results.push(...nested);
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".jpg")
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function getRuleForFile(filePath) {
  const rel = path.relative(IMAGES_DIR, filePath).replace(/\\/g, "/");
  for (const rule of RESIZE_RULES) {
    if (rule.match(rel)) {
      return { ...rule, rel };
    }
  }
  return null;
}

async function optimizeImage(filePath, rule) {
  const beforeStats = await stat(filePath);
  const beforeSize = beforeStats.size;

  const tempPath = filePath + ".tmp";

  await sharp(filePath)
    .rotate()
    .resize(rule.width, rule.height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: rule.quality, mozjpeg: true })
    .toFile(tempPath);

  const { rename } = await import("node:fs/promises");
  await rename(tempPath, filePath);

  const afterStats = await stat(filePath);
  const afterSize = afterStats.size;

  return { beforeSize, afterSize };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  console.log("Scanning for .jpg files in", IMAGES_DIR, "\n");

  const files = await collectJpgFiles(IMAGES_DIR);
  console.log(`Found ${files.length} .jpg files\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const rule = getRuleForFile(filePath);
    const rel = path.relative(IMAGES_DIR, filePath);

    if (!rule) {
      console.log(`  SKIP  ${rel} (no matching rule)`);
      skipped++;
      continue;
    }

    try {
      const { beforeSize, afterSize } = await optimizeImage(filePath, rule);
      totalBefore += beforeSize;
      totalAfter += afterSize;
      processed++;

      const saved = beforeSize - afterSize;
      const pct = beforeSize > 0 ? ((saved / beforeSize) * 100).toFixed(1) : 0;

      console.log(
        `  OK    ${rel.padEnd(50)} ${formatBytes(beforeSize).padStart(10)} -> ${formatBytes(afterSize).padStart(10)}  (${pct}% saved, ${rule.label})`
      );
    } catch (err) {
      failed++;
      console.error(`  FAIL  ${rel}: ${err.message}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Before:    ${formatBytes(totalBefore)}`);
  console.log(`  After:     ${formatBytes(totalAfter)}`);
  console.log(
    `  Saved:     ${formatBytes(totalBefore - totalAfter)} (${
      totalBefore > 0
        ? (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)
        : 0
    }%)`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
