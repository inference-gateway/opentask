import { rm, mkdir, cp, readFile, writeFile } from "node:fs/promises";
import { $ } from "bun";

const isFirefox = process.argv.includes("--firefox");
const isSafari = process.argv.includes("--safari");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/content.ts", "src/background.ts", "src/options.tsx", "src/popup.tsx", "src/sidepanel.tsx"],
  outdir: "dist",
  target: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const base = JSON.parse(await readFile("manifest.json", "utf-8"));

if (isFirefox) {
  const overrides = JSON.parse(await readFile("manifest.firefox.json", "utf-8"));
  const manifest = { ...base, ...overrides };
  delete manifest.side_panel; // Chrome-only; shallow merge can't remove keys
  await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
} else if (isSafari) {
  const overrides = JSON.parse(await readFile("manifest.safari.json", "utf-8"));
  const manifest = { ...base, ...overrides };
  delete manifest.side_panel;
  await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));
} else {
  await cp("manifest.json", "dist/manifest.json");
}

// Tailwind/shadcn CSS for the standalone pages only (options + popup). Bun.build does
// not process Tailwind, so compile it here to dist/options.css. The overlay stylesheet
// (styles.css) is copied verbatim below and stays GitHub-var-based.
await $`bun x @tailwindcss/cli -i src/ui/globals.css -o dist/options.css --minify`.quiet();

await cp("src/styles.css", "dist/styles.css");
await cp("src/options.html", "dist/options.html");
await cp("src/popup.html", "dist/popup.html");
await cp("src/sidepanel.html", "dist/sidepanel.html");
await cp("src/icons", "dist/icons", { recursive: true });

console.log("Built:", result.outputs.map((o) => o.path.replace(process.cwd() + "/", "")).join(", "));
