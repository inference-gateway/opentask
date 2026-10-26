// Generates extension icons from the source logo at /tmp/logo.png.
// Run: bun run tools/generate-icons.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SIZES = [16, 32, 48, 128];
const SRC = "/tmp/logo.png";

const src = readFile(SRC);
await mkdir("src/icons", { recursive: true });

for (const size of SIZES) {
  const png = await sharp(await src)
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(`src/icons/icon-${size}.png`, png);
  console.log(`Created src/icons/icon-${size}.png (${png.length} bytes)`);
}
