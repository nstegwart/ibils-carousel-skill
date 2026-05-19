#!/usr/bin/env node
/**
 * Regenerate ONE carousel after a manual QC fix.
 *
 * Use this when you have downloaded a finished carousel, looked at it, and a
 * slide is wrong — bad image, garbled text, or copy that needs editing.
 *
 * Flow:
 *   1. (optional) edit plan.json — fix the HEADLINE / BODY text in a slide's
 *      "brief". This is how you correct wording.
 *   2. run regen.js — it re-renders the slide(s) from plan.json, finalises,
 *      and (unless --no-upload) re-uploads to GCS, overwriting the old folder.
 *
 * Usage:
 *   node regen.js <content-id>            download from GCS, regen, re-upload
 *   node regen.js <path/to/carousel-dir>  use a local folder (must hold plan.json)
 * Options:
 *   --slide <sel>       regenerate ONLY this slide — a number (3), a kind
 *                       (cover/closing), or a name (03-statement). Repeat the
 *                       flag or comma-separate for several. Omit = whole carousel.
 *   --account <email>   pin a codex account from the pool
 *   --bucket <name>     GCS bucket (default: $GCS_BUCKET or ibils-carousel-content)
 *   --no-upload         regenerate fully LOCALLY, never touch GCS
 *
 * $GCS_KEY (service-account key) is needed only when uploading.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const TARGET = process.argv[2];
if (!TARGET || TARGET.startsWith("--")) {
  console.error(
    "usage: node regen.js <content-id | carousel-dir> [--slide <N>] " +
      "[--account <email>] [--bucket <name>] [--no-upload]"
  );
  process.exit(1);
}
const ACCOUNT = arg("--account", "");
const BUCKET = arg("--bucket", process.env.GCS_BUCKET || "ibils-carousel-content");
// --no-upload: regenerate fully LOCALLY, do not touch Google Cloud Storage.
const NO_UPLOAD = process.argv.includes("--no-upload");
// --slide <sel>: regenerate ONLY the selected slide(s). Comma-separated or the
// flag repeated. Empty = whole carousel.
const SLIDE_SEL = (() => {
  const v = [];
  process.argv.forEach((a, i) => {
    if (a === "--slide" && process.argv[i + 1]) v.push(...process.argv[i + 1].split(","));
  });
  return v.map((s) => s.trim()).filter(Boolean);
})();

async function isDir(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// run a sibling skill script, streaming its output
function run(file, args) {
  return new Promise((resolve, reject) => {
    const c = spawn("node", [path.join(HERE, file), ...args], {
      stdio: "inherit",
      env: process.env
    });
    c.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`))
    );
    c.on("error", reject);
  });
}

async function main() {
  let dir;
  let contentId;
  if (await isDir(TARGET)) {
    dir = path.resolve(TARGET);
    contentId = path.basename(dir.replace(/\/+$/, ""));
  } else {
    // a GCS content-id — download the folder first
    contentId = TARGET.replace(/\/+$/, "");
    dir = path.join(os.tmpdir(), `regen-${contentId}`);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(path.join(dir, "slides"), { recursive: true });
    console.log(`downloading gs://${BUCKET}/${contentId} ...`);
    await execFileP("gsutil", [
      "-m", "cp", "-r", `gs://${BUCKET}/${contentId}/*`, dir
    ], { env: process.env });
  }

  const planPath = path.join(dir, "plan.json");
  let plan;
  try {
    plan = JSON.parse(await fs.readFile(planPath, "utf8"));
  } catch {
    console.error(`no readable plan.json found in ${dir}`);
    process.exit(1);
  }

  const slidesDir = path.join(dir, "slides");
  await fs.mkdir(slidesDir, { recursive: true });

  // resolve --slide selectors to slide file names (same scheme as gen-carousel)
  let targetNames = null;
  if (SLIDE_SEL.length) {
    const named = (plan.slides || []).map((s, i) => ({
      kind: s.kind,
      name: `${String(i + 1).padStart(2, "0")}-${s.kind}`
    }));
    targetNames = [];
    for (const sel of SLIDE_SEL) {
      let hit;
      if (/^\d+$/.test(sel)) hit = named[Number(sel) - 1];
      else hit = named.find((s) => s.name === sel || s.kind === sel || s.name.includes(sel));
      if (!hit) {
        console.error(
          `--slide: nothing matches "${sel}". slides: ${named.map((s) => s.name).join(", ")}`
        );
        process.exit(1);
      }
      if (!targetNames.includes(hit.name)) targetNames.push(hit.name);
    }
  }

  if (targetNames) {
    // single-slide regen: delete ONLY the target PNGs. gen-carousel skips
    // every slide that still exists, so only these re-render. The rest of the
    // carousel (already finalised) is left untouched.
    for (const n of targetNames) {
      await fs.rm(path.join(slidesDir, `${n}.png`), { force: true });
    }
    console.log(`regenerating slide(s): ${targetNames.join(", ")}`);
  } else {
    // whole-carousel regen: wipe every slide, all re-render from plan.json
    await fs.rm(slidesDir, { recursive: true, force: true });
    await fs.mkdir(slidesDir, { recursive: true });
    console.log("regenerating slides ...");
  }

  const genArgs = [planPath, slidesDir];
  if (ACCOUNT) genArgs.push("--account", ACCOUNT);
  await run("gen-carousel.js", genArgs);
  console.log("finalising ...");
  const finArgs = [slidesDir];
  if (targetNames) finArgs.push("--only", targetNames.join(","));
  await run("finalize.js", finArgs);
  if (NO_UPLOAD) {
    console.log(`\nDONE — regenerated locally: ${dir}`);
    console.log("(not uploaded — open the slides/ folder to review)");
    return;
  }
  console.log(`uploading to gs://${BUCKET}/${contentId} ...`);
  await run("gcs-upload.js", [dir, contentId]);
  console.log(`\nDONE — regenerated gs://${BUCKET}/${contentId}/`);
}

main().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
