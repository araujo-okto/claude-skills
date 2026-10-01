# claude-skills

Personal Claude Code skills, published as a plugin marketplace.

## Install on any machine

In Claude Code:

```
/plugin marketplace add araujo-okto/claude-skills
/plugin install fastify-api-foundation@araujo-skills
```

(Private repo: the machine needs git access to GitHub — e.g. `gh auth login` or a credential helper.)

Update later with `/plugin marketplace update araujo-skills`.

## Skills

| Plugin | What it does |
| --- | --- |
| `fastify-api-foundation` | Fastify 5 + Prisma 7 + Zod 4 + strict TS ESM + Biome + Vitest backend foundation, with copy-ready templates verified by `npm run check`. |

## Adding a skill

1. `plugins/<name>/.claude-plugin/plugin.json` + `plugins/<name>/skills/<name>/SKILL.md`
2. Add an entry to `.claude-plugin/marketplace.json`
3. Commit, push, then `/plugin marketplace update araujo-skills` on other machines.
