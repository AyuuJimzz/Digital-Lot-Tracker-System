/**
 * Post-build safeguard: ensures no source maps ship with production builds.
 *
 * - Deletes every *.map file under build/
 * - Strips `//# sourceMappingURL=...` / `/*# sourceMappingURL=... *​/` comments
 *   from all bundled .js and .css files
 *
 * Runs automatically after `npm run build` via the "postbuild" hook,
 * regardless of how GENERATE_SOURCEMAP is configured on the build host.
 */
const fs = require("fs");
const path = require("path");

const BUILD_DIR = path.join(__dirname, "..", "build");

if (!fs.existsSync(BUILD_DIR)) {
  console.warn("remove-source-maps: build directory not found, skipping.");
  process.exit(0);
}

let mapsDeleted = 0;
let refsStripped = 0;

// 1. Recursively delete every .map file
function deleteMaps(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      deleteMaps(fullPath);
    } else if (entry.name.endsWith(".map")) {
      fs.unlinkSync(fullPath);
      mapsDeleted++;
      console.log(`remove-source-maps: deleted ${path.relative(BUILD_DIR, fullPath)}`);
    }
  }
}
deleteMaps(BUILD_DIR);

// 2. Strip sourceMappingURL comments from js/css bundles
const SOURCE_MAP_COMMENT = /\/[*/][#@]\s*sourceMappingURL=[^\s*]*\s*(?:\*\/)?\s*$/gm;

function stripRefs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      stripRefs(fullPath);
    } else if (entry.name.endsWith(".js") || entry.name.endsWith(".css")) {
      const content = fs.readFileSync(fullPath, "utf8");
      const cleaned = content.replace(SOURCE_MAP_COMMENT, "");
      if (cleaned !== content) {
        fs.writeFileSync(fullPath, cleaned);
        refsStripped++;
        console.log(`remove-source-maps: stripped sourceMappingURL from ${path.relative(BUILD_DIR, fullPath)}`);
      }
    }
  }
}
stripRefs(BUILD_DIR);

console.log(
  `remove-source-maps: done (${mapsDeleted} .map file(s) deleted, ${refsStripped} sourceMappingURL reference(s) stripped)`
);
