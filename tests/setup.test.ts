import { test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NAMED, setup } from "../create/setup";

// A scratch "template" folder named like an app, with just enough of the template in it
async function scratchTemplate(files: Record<string, string>) {
  const parent = mkdtempSync(`${tmpdir()}/setup-`);
  const root = join(parent, "my-app");
  mkdirSync(root);
  for (const [path, text] of Object.entries(files)) await Bun.write(join(root, path), text);
  return { root, done: () => rmSync(parent, { recursive: true, force: true }) };
}

test("setup turns the template into an app", async () => {
  const { root, done } = await scratchTemplate({
    "todo.jsonl": '{"n": 1}\n',
    "CHANGELOG.md": "# the template's changelog\n",
    "logo.png": "the template's logo",
    "create/setup.ts": "// this script",
    "tests/setup.test.ts": "// this script's test",
    "src/index.html": "<title>Paintbrush</title>",
    "CLAUDE.md": "# Paintbrush\n<!-- template -->\nNotes on developing the template.\n<!-- /template -->\nAbout the app.\n",
    ".claude/launch.json": '{ "name": "paintbrush" }',
    ".railway/railway.ts": 'project("paintbrush", {})',
    "node_modules/@blueshed/railroad/.claude/skills/railroad/SKILL.md": "the railroad skill",
  });
  try {
    await setup(root);

    expect(await Bun.file(join(root, "todo.jsonl")).text()).toBe(""); // a fresh ledger
    expect(await Bun.file(join(root, "CHANGELOG.md")).text()).toContain("## [Unreleased]");
    // what is about the template goes: its logo, this script and its test
    for (const path of ["logo.png", "create/setup.ts", "tests/setup.test.ts"]) {
      expect(await Bun.file(join(root, path)).exists()).toBe(false);
    }
    expect(await Bun.file(join(root, "README.md")).text()).toContain("# my-app");
    expect(await Bun.file(join(root, "src/index.html")).text()).toBe("<title>my-app</title>");
    expect(await Bun.file(join(root, ".claude/launch.json")).text()).toBe('{ "name": "my-app" }');
    expect(await Bun.file(join(root, ".railway/railway.ts")).text()).toBe('project("my-app", {})');
    expect(await Bun.file(join(root, "CLAUDE.md")).text()).toBe("# my-app\nAbout the app.\n");
    expect(await Bun.file(join(root, ".claude/skills/railroad/SKILL.md")).text()).toBe("the railroad skill");
  } finally {
    done();
  }
});

test("run as a script, the way bun create runs it, setup works on the current folder", async () => {
  const { root, done } = await scratchTemplate({
    "todo.jsonl": '{"n": 1}\n',
    "src/index.html": "<title>Paintbrush</title>",
  });
  try {
    const proc = Bun.spawn([process.execPath, `${import.meta.dir}/../create/setup.ts`], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
    expect(await proc.exited).toBe(0);
    expect(err).not.toContain("Error");
    expect(out).toContain("Setting up my-app...");
    expect(await Bun.file(join(root, "src/index.html")).text()).toBe("<title>my-app</title>");
    expect(await Bun.file(join(root, "todo.jsonl")).text()).toBe("");
  } finally {
    done();
  }
});

test("setup refuses to run in a clone of the template, and touches nothing", async () => {
  const { root, done } = await scratchTemplate({ "todo.jsonl": '{"n": 1}\n', "create/setup.ts": "// this script" });
  try {
    Bun.spawnSync(["git", "init", "-q"], { cwd: root });
    Bun.spawnSync(["git", "remote", "add", "origin", "https://github.com/blueshed/paintbrush.git"], { cwd: root });

    await expect(setup(root)).rejects.toThrow("clone of the paintbrush template");
    expect(await Bun.file(join(root, "todo.jsonl")).text()).toBe('{"n": 1}\n');
    expect(await Bun.file(join(root, "create/setup.ts")).exists()).toBe(true);
  } finally {
    done();
  }
});

test("setup says so when railroad's skills are not installed, and skips files that are not there", async () => {
  const { root, done } = await scratchTemplate({});
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args) => void warnings.push(args.join(" "));
  try {
    await setup(root);
    expect(warnings.join("\n")).toContain("no railroad skills found");
    expect(existsSync(join(root, ".claude/skills"))).toBe(false);
  } finally {
    console.warn = warn;
    done();
  }
});

test("every file setup renames exists, and the template's name is nowhere else", async () => {
  const root = `${import.meta.dir}/..`;
  for (const path of NAMED) expect(await Bun.file(`${root}/${path}`).exists()).toBe(true);

  // Files that may say "paintbrush": the ones setup renames, replaces or deletes, and package.json (bun create renames it)
  const allowed = new Set([...NAMED, "README.md", "CHANGELOG.md", "todo.jsonl", "package.json", "create/setup.ts", "tests/setup.test.ts"]);
  const listed = Bun.spawnSync(["git", "ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root }).stdout.toString();
  const strays: string[] = [];
  for (const path of listed.split("\n").filter((p) => p && !p.endsWith(".png") && !allowed.has(p))) {
    if (!existsSync(`${root}/${path}`)) continue; // listed, then deleted
    if (/paintbrush/i.test(await Bun.file(`${root}/${path}`).text())) strays.push(path);
  }
  expect(strays).toEqual([]);
});
