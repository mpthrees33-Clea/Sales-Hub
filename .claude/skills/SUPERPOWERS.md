# Superpowers (skills library)

This repo vendors the [**Superpowers**](https://github.com/obra/superpowers) skills
library by Jesse Vincent — the agentic skills framework featured in Anthropic's
official Claude Code plugin marketplace (`superpowers@claude-plugins-official`).

- **Version installed:** 5.1.0
- **Source:** https://github.com/obra/superpowers
- **License:** MIT (see `SUPERPOWERS-LICENSE`)

## How it's installed here

Rather than as a marketplace plugin (which lives in the ephemeral `~/.claude`
and is wiped when the remote container recycles), the skills are vendored into
the repo so they persist and load in every Claude Code session — local, web, or
GitHub-triggered — for this project.

- `skills/<name>/SKILL.md` — the 13 skills, auto-discovered by the `Skill` tool.
- `../hooks/superpowers-session-start.sh` — SessionStart hook that injects the
  `using-superpowers` meta-skill so skills trigger proactively.
- `../settings.json` — registers the SessionStart hook.

## Skills

| Skill | Use it for |
|-------|-----------|
| `using-superpowers` | Meta-skill: how to find and invoke skills (auto-loaded at session start) |
| `brainstorming` | Explore intent/requirements before any creative work |
| `writing-plans` | Turn a spec into a step-by-step implementation plan |
| `executing-plans` | Execute a written plan with review checkpoints |
| `subagent-driven-development` | Execute plans via subagents with built-in review |
| `dispatching-parallel-agents` | Run 2+ independent tasks in parallel |
| `test-driven-development` | TDD discipline before writing implementation code |
| `systematic-debugging` | Root-cause debugging for bugs / test failures |
| `verification-before-completion` | Prove work is done before claiming success |
| `requesting-code-review` | Get a review before merging |
| `receiving-code-review` | Handle review feedback with rigor |
| `using-git-worktrees` | Isolated workspace for feature work |
| `finishing-a-development-branch` | Merge / PR / cleanup options when done |
| `writing-skills` | Author or edit skills |

## Updating

```bash
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/superpowers
cp -r /tmp/superpowers/skills/* .claude/skills/
cp /tmp/superpowers/LICENSE .claude/skills/SUPERPOWERS-LICENSE
```

Then bump the version noted above and re-test the hook.
