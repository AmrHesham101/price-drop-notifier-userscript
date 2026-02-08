const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function human(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(2) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

const buildDir = path.join(process.cwd(), "build");
if (!fs.existsSync(buildDir)) {
  console.error("Build directory not found:", buildDir);
  process.exit(2);
}
const files = fs
  .readdirSync(buildDir)
  .filter((f) => !f.endsWith(".gz") && !f.endsWith(".map"));
if (files.length === 0) {
  console.log("No files found in build/ to gzip.");
  process.exit(0);
}

let totalOrig = 0,
  totalGz = 0;
let coreOrig = 0,
  coreGz = 0;

console.log("\n📦 Gzipping build files:\n");
for (const f of files) {
  const p = path.join(buildDir, f);
  const buf = fs.readFileSync(p);
  const gz = zlib.gzipSync(buf, { level: 9 });
  const gzPath = p + ".gz";
  fs.writeFileSync(gzPath, gz);
  const orig = buf.length;
  const gzlen = gz.length;
  totalOrig += orig;
  totalGz += gzlen;

  const isCore = f.includes(".min.");
  if (isCore) {
    coreOrig += orig;
    coreGz += gzlen;
  }

  const badge = isCore ? "🎯" : "  ";
  console.log(
    `${badge} ${f.padEnd(30)} ${human(orig).padStart(10)} → ${human(gzlen).padStart(10)} (${((gzlen / orig) * 100).toFixed(1)}%)`,
  );
}

console.log("\n" + "─".repeat(60));
console.log(
  `   TOTAL (all files)             ${human(totalOrig).padStart(10)} → ${human(totalGz).padStart(10)} (${((totalGz / totalOrig) * 100).toFixed(1)}%)`,
);
console.log(
  `🎯 WIDGET CORE (.min.js + .css)  ${human(coreOrig).padStart(10)} → ${human(coreGz).padStart(10)} (${((coreGz / coreOrig) * 100).toFixed(1)}%)`,
);
console.log("─".repeat(60));

if (coreGz <= 12 * 1024) {
  console.log(
    `\n✅ Widget core is ${human(coreGz)} gzipped — UNDER 12 KB limit! 🎉\n`,
  );
} else {
  console.log(
    `\n❌ Widget core is ${human(coreGz)} gzipped — EXCEEDS 12 KB limit!\n`,
  );
}

console.log(".gz files written to build/\n");
