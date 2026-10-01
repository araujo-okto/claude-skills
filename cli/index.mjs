#!/usr/bin/env node
// claude-skills — install the skills in this repo into AI coding agents.
// Zero dependencies (Node >= 20).
// Adapted from tech-leads-club/agent-skills — MIT License, Copyright (c) 2026 Tech Leads Club.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = join(REPO_ROOT, "plugins");
const LOCK_DIR = ".agents";
const LOCK_FILE = ".skill-lock.json";
const HOME = homedir();

// ── Agents: where each one reads skills (project-local and global) ───────────
const AGENTS = {
  "claude-code": { name: "Claude Code", local: ".claude/skills", global: ".claude/skills", marker: ".claude" },
  cursor: { name: "Cursor", local: ".cursor/skills", global: ".cursor/skills", marker: ".cursor" },
  "github-copilot": { name: "GitHub Copilot", local: ".github/skills", global: ".copilot/skills", marker: ".copilot" },
  windsurf: { name: "Windsurf", local: ".windsurf/skills", global: ".codeium/windsurf/skills", marker: ".codeium/windsurf" },
  cline: { name: "Cline", local: ".cline/skills", global: ".cline/skills", marker: ".cline" },
  codex: { name: "OpenAI Codex", local: ".codex/skills", global: ".codex/skills", marker: ".codex" },
  gemini: { name: "Gemini CLI", local: ".gemini/skills", global: ".gemini/skills", marker: ".gemini" },
  antigravity: { name: "Antigravity", local: ".agent/skills", global: ".gemini/antigravity/skills", marker: ".gemini/antigravity" },
  roo: { name: "Roo Code", local: ".roo/skills", global: ".roo/skills", marker: ".roo" },
  kilocode: { name: "Kilo Code", local: ".kilocode/skills", global: ".kilocode/skills", marker: ".kilocode" },
  kiro: { name: "Kiro", local: ".kiro/skills", global: ".kiro/skills", marker: ".kiro" },
  trae: { name: "TRAE", local: ".trae/skills", global: ".trae/skills", marker: ".trae" },
  "amazon-q": { name: "Amazon Q", local: ".amazonq/skills", global: ".amazonq/skills", marker: ".amazonq" },
};

// ── Output helpers ───────────────────────────────────────────────────────────
const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = color("1");
const dim = color("2");
const green = color("32");
const red = color("31");
const yellow = color("33");
const fail = (msg) => {
  console.error(red(`✖ ${msg}`));
  process.exit(1);
};

// ── Security: names become folder names; never let them escape the target ──
const sanitizeName = (name) => {
  const safe = String(name).toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/^[.-]+/, "");
  if (!safe) fail(`Invalid skill name: "${name}"`);
  return safe;
};
const isInside = (parent, child) => {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== "" && !rel.startsWith("..") && !parse(rel).root;
};

// ── Catalog: plugins/<plugin>/skills/<skill>/SKILL.md ────────────────────────
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return data;
}

function loadCatalog() {
  if (!existsSync(PLUGINS_DIR)) return [];
  const skills = [];
  for (const plugin of readdirSync(PLUGINS_DIR)) {
    const skillsDir = join(PLUGINS_DIR, plugin, "skills");
    if (!existsSync(skillsDir)) continue;
    for (const dir of readdirSync(skillsDir)) {
      const file = join(skillsDir, dir, "SKILL.md");
      if (!existsSync(file)) continue;
      const meta = parseFrontmatter(readFileSync(file, "utf8"));
      skills.push({
        name: meta.name || dir,
        description: meta.description || "",
        plugin,
        path: join(skillsDir, dir),
      });
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Project root: nearest dir with package.json or .git ─────────────────────
function findProjectRoot(start = process.cwd()) {
  let dir = resolve(start);
  while (dir !== parse(dir).root) {
    if (existsSync(join(dir, "package.json")) || existsSync(join(dir, ".git"))) return dir;
    dir = dirname(dir);
  }
  return resolve(start);
}

const scopeBase = (global) => (global ? HOME : findProjectRoot());
const agentDir = (agent, global) => join(scopeBase(global), global ? AGENTS[agent].global : AGENTS[agent].local);

function detectAgents() {
  const root = findProjectRoot();
  const found = Object.keys(AGENTS).filter(
    (a) => existsSync(join(HOME, AGENTS[a].marker)) || existsSync(join(root, AGENTS[a].marker)),
  );
  return found.length ? found : ["claude-code"];
}

// ── Lockfile (.agents/.skill-lock.json): what was installed, where, when ─────
const lockPath = (global) => join(scopeBase(global), LOCK_DIR, LOCK_FILE);

function readLock(global) {
  try {
    const data = JSON.parse(readFileSync(lockPath(global), "utf8"));
    return data && typeof data.skills === "object" ? data : { version: 1, skills: {} };
  } catch {
    return { version: 1, skills: {} };
  }
}

function writeLock(global, lock) {
  const file = lockPath(global);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(lock, null, 2)}\n`);
  renameSync(tmp, file); // atomic replace
}

// ── Core operations ──────────────────────────────────────────────────────────
function installSkill(skill, agents, global) {
  const safe = sanitizeName(skill.name);
  for (const agent of agents) {
    const base = agentDir(agent, global);
    const target = join(base, safe);
    if (!isInside(base, target)) fail(`Unsafe destination for ${skill.name}`);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(base, { recursive: true });
    cpSync(skill.path, target, { recursive: true });
    console.log(`${green("✔")} ${bold(skill.name)} → ${AGENTS[agent].name} ${dim(target)}`);
  }
}

function recordInstall(lock, skill, agents, global) {
  const now = new Date().toISOString();
  const prev = lock.skills[skill.name];
  lock.skills[skill.name] = {
    name: skill.name,
    source: `${skill.plugin}/${skill.name}`,
    agents: [...new Set([...(prev?.agents ?? []), ...agents])],
    global,
    installedAt: prev?.installedAt ?? now,
    updatedAt: now,
  };
}

// ── Argument handling ────────────────────────────────────────────────────────
function resolveAgents(values) {
  const agents = values.agent?.length ? values.agent : detectAgents();
  for (const a of agents) {
    if (!AGENTS[a]) fail(`Unknown agent "${a}". Run "claude-skills agents" to see the list.`);
  }
  return agents;
}

function resolveSkills(catalog, names) {
  return names.map((n) => catalog.find((s) => s.name === n) ?? fail(`Skill "${n}" not found. Run "claude-skills list".`));
}

async function promptSkills(catalog) {
  if (!process.stdin.isTTY) fail('No skills given. Use -s <name...> or "--all".');
  catalog.forEach((s, i) => console.log(`  ${bold(i + 1)}. ${s.name} ${dim(`— ${s.description.slice(0, 90)}`)}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nSkills to install (numbers, comma-separated, or "all"): ');
  const scope = await rl.question("Install globally for all projects? [Y/n]: ");
  rl.close();
  const picked =
    answer.trim().toLowerCase() === "all"
      ? catalog
      : answer
          .split(",")
          .map((n) => catalog[Number(n.trim()) - 1])
          .filter(Boolean);
  if (!picked.length) fail("Nothing selected.");
  return { picked, global: !/^n/i.test(scope.trim()) };
}

// ── Commands ─────────────────────────────────────────────────────────────────
const commands = {
  async list(values) {
    const catalog = loadCatalog();
    const global = values.global;
    const lock = readLock(global);
    console.log(bold(`\nAvailable skills (${catalog.length})  ${dim(global ? "scope: global" : "scope: project")}\n`));
    for (const s of catalog) {
      const installed = lock.skills[s.name];
      const badge = installed ? green(`installed → ${installed.agents.join(", ")}`) : dim("not installed");
      console.log(`  ${bold(s.name)}  ${badge}\n    ${dim(s.description.slice(0, 140))}\n`);
    }
  },

  async install(values) {
    const catalog = loadCatalog();
    const agents = resolveAgents(values);
    let skills;
    let global = values.global;
    if (values.all) skills = catalog;
    else if (values.skill?.length) skills = resolveSkills(catalog, values.skill);
    else ({ picked: skills, global } = await promptSkills(catalog));

    const lock = readLock(global);
    for (const skill of skills) {
      installSkill(skill, agents, global);
      recordInstall(lock, skill, agents, global);
    }
    writeLock(global, lock);
    console.log(dim(`\nRestart your agent session to load new skills.`));
  },

  async update(values) {
    const catalog = loadCatalog();
    const global = values.global;
    const lock = readLock(global);
    const names = values.skill?.length ? values.skill : Object.keys(lock.skills);
    if (!names.length) return console.log(yellow("No installed skills in this scope."));
    for (const name of names) {
      const entry = lock.skills[name];
      if (!entry) {
        console.log(yellow(`• ${name} is not installed here — skipped`));
        continue;
      }
      const [skill] = resolveSkills(catalog, [name]);
      installSkill(skill, entry.agents, global);
      recordInstall(lock, skill, entry.agents, global);
    }
    writeLock(global, lock);
  },

  async remove(values) {
    if (!values.skill?.length) fail("Use -s <name...> to choose what to remove.");
    const global = values.global;
    const lock = readLock(global);
    for (const name of values.skill) {
      const entry = lock.skills[name];
      if (!entry && !values.force) {
        console.log(yellow(`• ${name} not in lockfile — skipped (use --force)`));
        continue;
      }
      const agents = values.agent?.length ? resolveAgents(values) : (entry?.agents ?? resolveAgents(values));
      for (const agent of agents) {
        const base = agentDir(agent, global);
        const target = join(base, sanitizeName(name));
        if (!isInside(base, target)) fail(`Unsafe path for ${name}`);
        rmSync(target, { recursive: true, force: true });
        console.log(`${green("✔")} removed ${bold(name)} from ${AGENTS[agent].name}`);
      }
      const remaining = (entry?.agents ?? []).filter((a) => !agents.includes(a));
      if (entry && remaining.length) entry.agents = remaining;
      else delete lock.skills[name];
    }
    writeLock(global, lock);
  },

  async agents() {
    const detected = new Set(detectAgents());
    console.log(bold("\nSupported agents\n"));
    for (const [id, a] of Object.entries(AGENTS)) {
      const mark = detected.has(id) ? green("●") : dim("○");
      console.log(`  ${mark} ${bold(id.padEnd(15))} ${a.name.padEnd(15)} ${dim(`project: ${a.local}  global: ~/${a.global}`)}`);
    }
    console.log(dim("\n● = detected on this machine/project (used by default when -a is omitted)"));
  },

  help() {
    console.log(`
${bold("claude-skills")} — install this repo's skills into AI coding agents

${bold("Usage")}
  npx github:araujo-okto/claude-skills <command> [options]

${bold("Commands")}
  list, ls              List skills and install status
  install               Install skills (interactive when -s is omitted)
  update                Reinstall installed skills from the latest repo version
  remove, rm            Remove skills
  agents                List supported agents and their skill folders

${bold("Options")}
  -s, --skill <name>    Skill name (repeatable)
  -a, --agent <id>      Target agent (repeatable; default: detected agents)
  -g, --global          Use the user home instead of the current project
      --all             Install every skill
  -f, --force           Remove even if not in the lockfile
  -h, --help            Show this help

${bold("Examples")}
  claude-skills install -s fastify-api-foundation -g
  claude-skills install -s fastify-api-foundation -a claude-code -a cursor
  claude-skills update -g
  claude-skills rm -s fastify-api-foundation -g
`);
  },
};

const aliases = { ls: "list", rm: "remove", i: "install" };

// Allow "-s a b c" like the original CLI: expand trailing bare words into repeated flags.
function normalizeArgv(argv) {
  const out = [];
  let last = null;
  for (const arg of argv) {
    if (arg.startsWith("-")) {
      last = ["-s", "--skill", "-a", "--agent"].includes(arg) ? arg : null;
      out.push(arg);
    } else if (last && out.at(-1) !== last) {
      out.push(last, arg);
    } else {
      out.push(arg);
    }
  }
  return out;
}

async function main() {
  const [rawCommand = "help", ...rest] = process.argv.slice(2);
  const command = aliases[rawCommand] ?? rawCommand;
  if (command === "-h" || command === "--help") return commands.help();
  if (!commands[command]) {
    commands.help();
    fail(`Unknown command "${rawCommand}"`);
  }

  const { values } = parseArgs({
    args: normalizeArgv(rest),
    options: {
      skill: { type: "string", short: "s", multiple: true },
      agent: { type: "string", short: "a", multiple: true },
      global: { type: "boolean", short: "g", default: false },
      all: { type: "boolean", default: false },
      force: { type: "boolean", short: "f", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) return commands.help();
  await commands[command](values);
}

main().catch((error) => fail(error.message));
