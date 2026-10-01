# claude-skills

Personal skills for AI coding agents: a **Claude Code plugin marketplace** plus a **terminal CLI** that installs the same skills into Cursor, Copilot, Codex, Gemini and other agents.

> Private repo: each machine needs git access to GitHub (e.g. Git Credential Manager, `gh auth login` or an SSH key).

## Install in Claude Code (recommended)

Inside Claude Code:

```
/plugin marketplace add araujo-okto/claude-skills
/plugin install fastify-api-foundation@araujo-skills
```

| Action | Command |
| --- | --- |
| Update to the latest push | `/plugin marketplace update araujo-skills` |
| See / toggle plugins | `/plugin` |
| Uninstall | `/plugin uninstall fastify-api-foundation@araujo-skills` |

Restart the session after installing. Skills trigger automatically from their description, or explicitly as `/fastify-api-foundation:fastify-api-foundation`.

## Install with the CLI (any agent)

There's no global install. `npx` fetches the latest version from GitHub (Node ≥ 20):

```bash
# Interactive: choose skills and scope
npx github:araujo-okto/claude-skills install

# Non-interactive
npx github:araujo-okto/claude-skills install -s fastify-api-foundation -g          # global, detected agents
npx github:araujo-okto/claude-skills install -s fastify-api-foundation -a cursor   # this project, Cursor only

npx github:araujo-okto/claude-skills list       # skills + install status
npx github:araujo-okto/claude-skills update -g  # refresh installed skills
npx github:araujo-okto/claude-skills rm -s fastify-api-foundation -g
npx github:araujo-okto/claude-skills agents     # supported agents and folders
```

| Option | Meaning |
| --- | --- |
| `-s, --skill <name...>` | Skill(s) to act on |
| `-a, --agent <id...>` | Target agents. Default: the agents detected on the machine or project. |
| `-g, --global` | User home (all projects) instead of the current project |
| `--all` | Install every skill |
| `-f, --force` | Remove even if the lockfile doesn't list it |

Installs are copies into each agent's skill folder (e.g. `~/.claude/skills/<skill>`, `.cursor/skills/<skill>`). They're tracked in `.agents/.skill-lock.json`, so `update` and `remove` know what is where.

> Using both the Claude Code plugin **and** `-a claude-code` duplicates the skill, so pick one per machine.

## Skills

| Skill | What it does |
| --- | --- |
| `fastify-api-foundation` | Fastify 5 + Prisma 7 + Zod 4 + strict TS ESM + Biome + Vitest backend foundation, with copy-ready templates verified by `npm run check`. |

## Contributing a skill

See [AGENTS.md](AGENTS.md). It's written for AI agents and humans alike.

---

CLI adapted from [tech-leads-club/agent-skills](https://github.com/tech-leads-club/agent-skills) (MIT).
