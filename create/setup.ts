#!/usr/bin/env bun

// Post-create setup: `bun create blueshed/paintbrush my-app` runs this as the
// template's postinstall, after `bun install` and before the first commit.
//
// It turns the template into an app. What is about developing the template goes
// (its ledger, its changelog, its logo, this script and its test); the app starts
// with fresh ones; its name replaces "Paintbrush"; and the skills that railroad
// ships are copied into .claude/skills, so a session starts knowing them.

import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

// The files that carry the app's name, as "Paintbrush" (the page title, which the
// test expects) or "paintbrush" (the Railway project, the dev server's name)
export const NAMED = [
  "src/index.html",
  "tests/site.test.ts",
  "CLAUDE.md",
  ".claude/DESIGN.md",
  ".claude/launch.json",
  ".railway/railway.ts",
  "bun.lock", // the root package's name
];

// The template's own clone is the one place this must never run: it deletes things
function isTemplateClone(root: string) {
  const origin = Bun.spawnSync(["git", "remote", "get-url", "origin"], { cwd: root }).stdout.toString();
  return /blueshed\/paintbrush(\.git)?\s*$/.test(origin);
}

export async function setup(root: string) {
  if (isTemplateClone(root)) throw new Error(`${root} is a clone of the paintbrush template: setup would delete its ledger and changelog`);

  const name = root.split("/").pop() || "my-app";
  console.log(`Setting up ${name}...`);

  for (const path of ["todo.jsonl", "CHANGELOG.md", "logo.png", "create", "tests/setup.test.ts"]) {
    rmSync(join(root, path), { recursive: true, force: true });
  }
  await Bun.write(join(root, "todo.jsonl"), "");
  await Bun.write(join(root, "CHANGELOG.md"), changelog);
  await Bun.write(join(root, "README.md"), readme(name));

  for (const path of NAMED) {
    const file = Bun.file(join(root, path));
    if (!(await file.exists())) continue;
    const text = (await file.text())
      .replace(/<!-- template -->[\s\S]*?<!-- \/template -->\n?/g, "") // notes for working on the template itself
      .replaceAll("Paintbrush", name)
      .replaceAll("paintbrush", name);
    await Bun.write(file, text);
  }

  const skills = join(root, "node_modules/@blueshed/railroad/.claude/skills");
  if (existsSync(skills)) {
    cpSync(skills, join(root, ".claude/skills"), { recursive: true });
    console.log("  copied the railroad skills into .claude/skills");
  } else {
    console.warn("  no railroad skills found: after `bun install`, copy node_modules/@blueshed/railroad/.claude/skills into .claude/skills");
  }

  console.log(`
  ${name} is ready!

  bun dev            # http://localhost:3000, hot reload
  bun run stop       # stop a server started in the background
  bun test           # tests, held at 100% coverage
  bun run typecheck  # tsc

  Read CLAUDE.md first: it says what is here and what to add when you need it.
`);
}

const changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

- Started from [paintbrush](https://github.com/blueshed/paintbrush).
`;

const readme = (name: string) => `# ${name}

A Bun website with railroad for the page and Railway for the deploy, started from
[paintbrush](https://github.com/blueshed/paintbrush).

\`\`\`sh
bun dev            # http://localhost:3000
bun test           # tests, held at 100% coverage
bun run typecheck
\`\`\`

CLAUDE.md says what is here and what to add when you need it. \`todo.jsonl\` is the
ledger of open work; \`CHANGELOG.md\` records what has changed.
`;

// Last, so the constants above exist when it runs. Only when run (bun create's
// postinstall), never on import: tests call setup() on a scratch folder.
if (import.meta.main) await setup(process.cwd());
