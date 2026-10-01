# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this repo is

A catalog of agent skills distributed two ways from the same files:

1. **Claude Code plugin marketplace**: `.claude-plugin/marketplace.json` lists one plugin per skill.
2. **Terminal CLI**: `cli/index.mjs` copies skills into any supported agent's folder.

There is no build step, no registry file and no runtime dependencies. The folder layout *is* the catalog.

## Layout

```text
.claude-plugin/marketplace.json        # marketplace "araujo-skills": one entry per plugin
plugins/<plugin>/
  .claude-plugin/plugin.json           # name, version, description, author
  skills/<skill>/
    SKILL.md                           # required: YAML frontmatter + instructions
    references/                        # optional: docs loaded on demand
    assets/                            # optional: templates/files copied into projects
    scripts/                           # optional: executable helpers
cli/index.mjs                          # zero-dependency installer (Node >= 20)
```

The CLI discovers skills by scanning `plugins/*/skills/*/SKILL.md`. Nothing else needs registering for the CLI.

## Adding a skill

1. Create `plugins/<name>/skills/<name>/SKILL.md` with this frontmatter:
   ```yaml
   ---
   name: <name>                 # kebab-case, equals the folder name
   description: <what it does + when to use it, one line, specific trigger phrases>
   ---
   ```
2. Create `plugins/<name>/.claude-plugin/plugin.json`:
   ```json
   { "name": "<name>", "version": "1.0.0", "description": "...", "author": { "name": "araujo-okto" } }
   ```
3. Add `{ "name", "source": "./plugins/<name>", "description" }` to `plugins` in `.claude-plugin/marketplace.json`.
4. Add a row to the Skills table in `README.md`.
5. Validate (below), commit with a conventional message (`feat(<name>): ...`) and push to `main`.

## Changing a skill

- Bump `version` in that plugin's `plugin.json`. Claude Code uses it to detect updates.
- If the skill ships code templates, verify them before pushing: copy them into a scratch project and run their checks. For `fastify-api-foundation` that means `npm install && npm run prisma:generate && npm run check`.
- Users pick up changes with `/plugin marketplace update araujo-skills` or `npx github:araujo-okto/claude-skills update -g`.

## Validate before pushing

```bash
claude plugin validate .                 # marketplace manifest
claude plugin validate plugins/<name>    # each plugin manifest
node cli/index.mjs list                  # CLI sees every skill with name + description
```

## Writing good skills

- **The description triggers the skill.** State what it does and the concrete situations and phrases where it applies. Write it a little "pushy", because agents tend to under-trigger.
- **Keep SKILL.md under ~500 lines.** Move depth into `references/` and say in SKILL.md *when* to read each file.
- **Explain why, not only what.** Rules that carry their reason generalize better than all-caps MUSTs.
- **Make it portable.** Use no business or project specifics, no absolute paths, no secrets, and no personal data.
- **Avoid surprises.** No obfuscated code and no network calls or file writes the user wouldn't expect from the description.

## CLI conventions (`cli/index.mjs`)

- Single file, ESM, Node built-ins only. Keep it dependency-free so `npx github:` stays fast.
- Agent folders live in the `AGENTS` map (`local`, `global`, `marker`). To add an agent, add one entry.
- Every destination passes `sanitizeName` + `isInside`. Never write outside the target agent folder.
- The lockfile is `.agents/.skill-lock.json` (project) or `~/.agents/.skill-lock.json` (global), written atomically.
- Test changes manually: `node cli/index.mjs install -s <skill> -a cursor` inside a temp dir, then `list`, `update`, `rm`.
