# .cortex

This directory contains project context for the K2P5 development agents.

## Structure

```
.cortex/
├── config.json     # Project configuration
├── .gitignore      # Git ignore rules
├── plans/          # Saved implementation plans (version controlled)
│   └── *.md
└── sessions/       # Session summaries (gitignored by default)
    └── *.md
```

## Plans

Plans are saved by the **Plan agent** and can be loaded by **Build/Debug agents**.

They include:
- Architecture diagrams (mermaid)
- Task breakdowns with checkboxes
- Technical approach and phases
- Risk assessments
- Key decisions with rationale

### Plan Format

Plans are saved as markdown files with frontmatter:

```markdown
---
title: "Feature Name"
type: feature
created: 2024-02-22T10:00:00Z
status: draft
---

# Plan: Feature Name

## Summary
...

## Architecture Diagram
\`\`\`mermaid
graph TD
    A --> B
\`\`\`

## Tasks
- [ ] Task 1
- [ ] Task 2
```

## Sessions

Session summaries capture key decisions made during development.

They include:
- Summary of work accomplished
- Key decisions made
- Files changed (optional)
- Related plan reference

Sessions are **gitignored by default** but can be version controlled if desired by modifying `.cortex/.gitignore`.

## Configuration

Edit `config.json` to customize:

- **worktree.root**: Where worktrees are created (default: `../.worktrees`)
- **branches.protected**: Branches that require branch/worktree creation before changes
- **plans.includeMermaid**: Whether plans should include mermaid diagrams
- **sessions.retention**: Days to keep session files

## Usage

The K2P5 agents will automatically:

1. **Plan Agent**: Save plans to `.cortex/plans/` with mermaid diagrams
2. **Build Agent**: Check branch status, load plans, save session summaries
3. **Debug Agent**: Create hotfix branches/worktrees, document fixes

## Tools Available

| Tool | Description |
|------|-------------|
| `cortex_init` | Initialize .cortex directory |
| `cortex_status` | Check .cortex status |
| `plan_save` | Save implementation plan |
| `plan_list` | List saved plans |
| `plan_load` | Load a plan |
| `session_save` | Save session summary |
| `session_list` | List recent sessions |
| `branch_status` | Check git branch status |
| `branch_create` | Create feature/bugfix branch |
| `worktree_create` | Create isolated worktree |
| `worktree_list` | List worktrees |
| `worktree_open` | Get command to open terminal in worktree |
