#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const isGlobal = args.includes("--global");

const home = process.env.HOME || process.env.USERPROFILE;
const targetBase = isGlobal
  ? path.join(home, ".claude", "skills")
  : path.join(process.cwd(), ".claude", "skills");

const skillsSource = path.resolve(__dirname, "..", "skills");

if (!fs.existsSync(skillsSource)) {
  console.error("Error: skills/ directory not found at", skillsSource);
  process.exit(1);
}

const skillDirs = fs
  .readdirSync(skillsSource, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

if (skillDirs.length === 0) {
  console.error("Error: No skill directories found in", skillsSource);
  process.exit(1);
}

fs.mkdirSync(targetBase, { recursive: true });

console.log();
console.log(
  isGlobal
    ? "Installing Next.js Claude skills globally..."
    : "Installing Next.js Claude skills to project..."
);
console.log(`Target: ${targetBase}`);
console.log();

let installed = 0;

for (const skill of skillDirs) {
  const src = path.join(skillsSource, skill);
  const dest = path.join(targetBase, skill);

  fs.cpSync(src, dest, { recursive: true });
  console.log(`  \u2713 ${skill}`);
  installed++;
}

console.log();
console.log(`Done! ${installed} skills installed.`);
console.log();
console.log(
  "Skills are auto-activated by Claude Code based on your prompts."
);
console.log("No additional configuration needed.");
console.log();
