import sharp from "sharp";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const IMAGES_DIR = path.resolve("public/images");
const OUTPUT_DIR = path.resolve("src/generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "blur-data.json");

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

async function generateBlurPlaceholder(filePath) {
  const buffer = await sharp(filePath)
    .resize(10, 10, { fit: "inside" })
    .jpeg({ quality: 50 })
    .toBuffer();

  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function main() {
  console.log("Scanning for .jpg files in", IMAGES_DIR, "\n");

  const files = await collectJpgFiles(IMAGES_DIR);
  console.log(`Found ${files.length} .jpg files\n`);

  const blurMap = {};
  let processed = 0;
  let failed = 0;

  for (const filePath of files) {
    const rel = path.relative(IMAGES_DIR, filePath).replace(/\\/g, "/");
    const publicPath = `/images/${rel}`;

    try {
      const dataUri = await generateBlurPlaceholder(filePath);
      blurMap[publicPath] = dataUri;
      processed++;
      console.log(`  OK    ${publicPath}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL  ${publicPath}: ${err.message}`);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(blurMap, null, 2), "utf-8");

  console.log("\n--- Summary ---");
  console.log(`  Processed:  ${processed}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Output:     ${OUTPUT_FILE}`);
  console.log(`  Entries:    ${Object.keys(blurMap).length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
