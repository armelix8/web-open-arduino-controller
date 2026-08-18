/**
 * Reinstall node_modules outside Nextcloud (Windows file locks / missing files).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const project = process.cwd();
const destRoot = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  "bt-arduino-controller",
  "npm"
);
const destModules = path.join(destRoot, "node_modules");
const projectModules = path.join(project, "node_modules");
// Keep Next cache *next to* node_modules so compiled server files can resolve `next`/`react`
const destNext = path.join(destRoot, ".next-local");
const projectNext = path.join(project, ".next-local");

fs.mkdirSync(destRoot, { recursive: true });
fs.copyFileSync(path.join(project, "package.json"), path.join(destRoot, "package.json"));
if (fs.existsSync(path.join(project, "package-lock.json"))) {
  fs.copyFileSync(
    path.join(project, "package-lock.json"),
    path.join(destRoot, "package-lock.json")
  );
}

console.log("Installing into", destRoot);
const install = spawnSync("npm", ["install", "--ignore-scripts"], {
  cwd: destRoot,
  stdio: "inherit",
  shell: true,
});
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

if (fs.existsSync(projectModules)) {
  const bak = path.join(project, "node_modules.broken");
  try {
    if (fs.existsSync(bak)) fs.rmSync(bak, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    fs.renameSync(projectModules, bak);
    console.log("Renamed old node_modules → node_modules.broken");
  } catch (err) {
    console.warn(
      "Could not move project node_modules (stop npm run dev + pause Nextcloud):",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

try {
  fs.symlinkSync(destModules, projectModules, "junction");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

console.log("Linked node_modules →", destModules);

fs.mkdirSync(destNext, { recursive: true });
try {
  if (fs.existsSync(projectNext)) {
    const st = fs.lstatSync(projectNext);
    if (st.isSymbolicLink() || st.isDirectory()) {
      fs.rmSync(projectNext, { recursive: true, force: true });
    }
  }
  fs.symlinkSync(destNext, projectNext, "junction");
  console.log("Linked .next-local →", destNext);
} catch (err) {
  console.warn(
    "Could not junction .next-local (stop npm run dev):",
    err instanceof Error ? err.message : err
  );
}

process.exit(0);
