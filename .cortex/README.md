# .cortex

This directory contains project context for the Cortex development agents.

## Structure

- `plans/` - Saved implementation plans (version controlled)
- `sessions/` - Session summaries (gitignored)
- `config.json` - Project configuration

## Plans

Plans are saved by the Plan agent and can be loaded by Build/Debug agents.
They include:
- Architecture diagrams (mermaid)
- Task breakdowns
- Technical decisions

## Sessions

Session summaries capture key decisions made during development.
They are gitignored by default but can be kept if needed.

## Usage

The Cortex agents will automatically use this directory for:
- Saving implementation plans before coding
- Recording session summaries with key decisions
- Managing worktree and branch workflows
