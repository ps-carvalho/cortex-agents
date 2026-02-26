<p align="center">
  <img src="https://img.shields.io/badge/cortex-agents-111?style=for-the-badge&labelColor=111&color=4d96ff" alt="cortex-agents" height="40">
</p>

<h3 align="center">Supercharge OpenCode with structured workflows, intelligent agents, and automated development practices.</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/cortex-agents"><img src="https://img.shields.io/npm/v/cortex-agents.svg?style=flat-square&color=4d96ff" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/cortex-agents"><img src="https://img.shields.io/npm/dm/cortex-agents.svg?style=flat-square&color=6bcb77" alt="npm downloads"></a>
  <a href="https://github.com/ps-carvalho/cortex-agents/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/cortex-agents.svg?style=flat-square&color=ffd93d" alt="license"></a>
  <a href="https://opencode.ai"><img src="https://img.shields.io/badge/OpenCode-Plugin-4d96ff?style=flat-square" alt="OpenCode Plugin"></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-what-it-does">What It Does</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-agents">Agents</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-tools">Tools</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-skills">Skills</a>&nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-contributing">Contributing</a>
</p>

<br>

---

<br>

## Why Cortex Agents?

AI coding assistants are powerful, but without structure they produce inconsistent results. **Cortex Agents** adds the missing layer: a complete development workflow that turns OpenCode into a disciplined engineering partner.

- **Before**: AI writes code wherever, no branching discipline, no documentation, no plan.
- **After**: AI checks git status, asks about branching strategy, loads implementation plans, creates docs with architecture diagrams, commits cleanly, and opens PRs.

<br>

## Quick Start

```bash
npx cortex-agents install       # Add plugin + agents + skills
npx cortex-agents configure     # Pick your models interactively
# Restart OpenCode - done.
```

That's it. Your OpenCode session now has 9 specialized agents, 29 tools, and 14 domain skills.

> **Built-in Agent Replacement** — When installed, cortex-agents automatically disables OpenCode's native `build` and `plan` agents (replaced by `implement` and `architect`). The `architect` agent becomes the default, promoting a planning-first workflow. Native agents are fully restored on `uninstall`.

<br>

## What It Does

### Plan, Build, Ship

Cortex agents follow a structured workflow from planning through to PR:

```
You: "Add user authentication"

Architect Agent                         reads codebase, creates plan with mermaid diagrams
   saves to .cortex/plans/             "Plan saved. Switch to Implement?"

Implement Agent                         loads plan, checks git status
   "You're on main. Create a branch     two-step prompt: strategy -> execution
    or worktree?"
   creates feature/user-auth            implements following the plan
   "Ready to finalize?"                 stages, commits, pushes, opens PR
```

### Worktree Support

Create isolated development environments for parallel work:

```
Architect: "Plan saved. Create a worktree first?"
  → worktree_create with plan-based name
  → reports path: .worktrees/feature-user-auth/
  → "Navigate to the worktree and start Implement agent"
```

Plans are automatically propagated into the worktree's `.cortex/plans/` so the new session has full context.

### Task Finalizer

One tool to close the loop:

```
task_finalize
   git add -A
   git commit -m "feat: add user auth"
   git push -u origin feature/user-auth
   gh pr create --base main               auto-detected if in worktree
       PR body auto-populated from .cortex/plans/
   "PR created! Clean up worktree?"
```

### Auto-Prompted Documentation

After every task, agents prompt you to document what you built:

| Type | What's Generated | Includes |
|------|-----------------|----------|
| **Decision** | Architecture Decision Record | Mermaid graph comparing options |
| **Feature** | Feature documentation | Mermaid component diagram |
| **Flow** | Process/data flow doc | Mermaid sequence diagram |

All docs are saved to `docs/` with an auto-generated `INDEX.md`.

<br>

## Agents

### Primary Agents (3)

Handle complex, multi-step work. Use your best model.

| Agent | Role | Superpower |
|-------|------|-----------|
| **architect** | Read-only analysis & entry point | Plans with mermaid diagrams, acceptance criteria, NFR analysis, delegates to implement |
| **implement** | Full-access development | Skill-aware implementation, REPL loop with ACs, parallel quality gates, task finalizer |
| **fix** | Quick turnaround bug fixes | Rapid diagnosis, optional REPL loop, delegates deep debugging to @debug |

### Subagents (6)

Focused specialists launched **automatically** as parallel quality gates. Each auto-loads its core domain skill for deeper analysis. Use a fast/cheap model.

| Agent | Role | Auto-Loads Skill | Triggered By |
|-------|------|-----------------|-------------|
| **@testing** | Writes tests, runs suite, reports coverage | `testing-strategies` | Implement (always), Fix (always) |
| **@security** | OWASP audit, secrets scan, code-level fix patches | `security-hardening` | Implement (always), Fix (if security-relevant) |
| **@audit** | Code quality, tech debt scoring, pattern review | `code-quality` | Implement (always) |
| **@coder** | Cross-layer implementation + feasibility analysis | Per-layer skills | Implement (multi-layer features), Architect (analysis) |
| **@devops** | CI/CD validation, IaC review, deployment strategy | `deployment-automation` | Implement (when CI/Docker/infra files change) |
| **@debug** | Root cause analysis, log analysis, troubleshooting | `testing-strategies` | Fix (complex issues) |

Subagents return **structured reports** with severity levels (`BLOCKING`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) that the orchestrating agent uses to decide whether to proceed or fix issues first.

### Skill Routing

All agents detect the project's technology stack and **automatically load relevant skills** before working. This turns the 14 domain skills from passive knowledge into active intelligence:

```
Implement Agent detects: package.json has React + Express + Prisma
  → auto-loads: frontend-development, backend-development, database-design, api-design
  → implements with deep framework-specific knowledge
```

<br>

## Tools

29 tools bundled and auto-registered. No configuration needed.

<table>
<tr><td width="50%">

**Git Workflow**
- `branch_status` - Current branch + change detection
- `branch_create` - Convention-named branches (with toast notifications)
- `branch_switch` - Safe branch switching
- `worktree_create` - Isolated worktree in `.worktrees/`
- `worktree_list` / `worktree_remove` / `worktree_open`

</td><td width="50%">

**Planning & Sessions**
- `plan_save` / `plan_load` / `plan_list` / `plan_delete`
- `session_save` / `session_list` / `session_load`
- `cortex_init` / `cortex_status` / `cortex_configure`

</td></tr>
<tr><td width="50%">

**Documentation**
- `docs_init` - Set up `docs/` structure
- `docs_save` - Save doc with mermaid diagrams
- `docs_list` - Browse all docs
- `docs_index` - Rebuild `docs/INDEX.md`

</td><td width="50%">

**Finalization & Config**
- `task_finalize` - Stage, commit, push, create PR
  - Auto-detects worktree (targets main)
  - Auto-populates PR from `.cortex/plans/`
  - Auto-links issues via `Closes #N` from plan metadata
  - Warns if docs are missing
- `cortex_configure` - Set models from within an agent session

</td></tr>
<tr><td colspan="2">

**GitHub Integration**
- `github_status` - Check `gh` CLI availability, authentication, and detect GitHub Projects
- `github_issues` - List/filter repo issues by state, labels, milestone, assignee
- `github_projects` - List GitHub Project boards and their work items

The architect agent uses these tools to browse your backlog and seed plans from real GitHub issues. Issue numbers are stored in plan frontmatter (`issues: [42, 51]`) and automatically appended as `Closes #N` to the PR body when `task_finalize` runs — GitHub auto-closes the issues when the PR merges. Supports both github.com and GitHub Enterprise Server URLs.

</td></tr>
<tr><td colspan="2">

**REPL Loop** (Iterative Task-by-Task Implementation)
- `repl_init` - Initialize a loop from a plan (parses tasks + acceptance criteria, auto-detects build/test commands)
- `repl_status` - Get current progress, active task with ACs, retry counts (auto-advances to next task)
- `repl_report` - Report task outcome (`pass`/`fail`/`skip`) with auto-retry and escalation
- `repl_summary` - Generate markdown summary table with AC satisfaction for PR body

The implement agent uses these tools to work through plan tasks one at a time, running build+test verification after each task. Each task can have **acceptance criteria** (`- AC:` lines in the plan) displayed during implementation. Failed tasks are automatically retried (up to a configurable limit) before escalating to the user. State is persisted to `.cortex/repl-state.json` so progress survives context compaction and session restarts.

</td></tr>
</table>

<br>

## Skills

14 domain-specific skill packs loaded on demand via the `skill` tool:

| Skill | Covers |
|-------|--------|
| **frontend-development** | React, Vue, Svelte, CSS architecture, accessibility |
| **backend-development** | API design, middleware, auth, caching, queue systems |
| **mobile-development** | React Native, Flutter, native iOS/Android patterns |
| **desktop-development** | Electron, Tauri, native desktop application patterns |
| **database-design** | Schema design, migrations, indexing, query optimization |
| **api-design** | REST, GraphQL, gRPC, versioning, documentation |
| **testing-strategies** | Unit, integration, E2E, TDD, coverage strategies |
| **security-hardening** | OWASP, auth/authz, input validation, secure coding |
| **deployment-automation** | CI/CD, Docker, Kubernetes, cloud deployment |
| **architecture-patterns** | Microservices, monorepo, event-driven, CQRS |
| **design-patterns** | GoF patterns, SOLID principles, DDD |
| **performance-optimization** | Profiling, caching, lazy loading, bundle optimization |
| **code-quality** | Refactoring, linting, code review, maintainability |
| **git-workflow** | Branching strategies, worktrees, rebase vs merge |

<br>

## Model Configuration

Cortex agents are **model-agnostic**. Configure globally or per-project:

```bash
npx cortex-agents configure            # Global (all projects)
npx cortex-agents configure --project  # Per-project (saves to .opencode/models.json)
```

```
? Select model for PRIMARY agents (architect, implement, fix):
  Claude Sonnet 4    (anthropic)     Best balance of intelligence and speed
  Claude Opus 4      (anthropic)     Most capable, best for complex architecture
  GPT-4.1            (openai)        Fast multimodal model
  Gemini 2.5 Pro     (google)        Large context window, strong reasoning
  Kimi K2P5          (kimi)          Optimized for code generation
  Enter custom model ID

? Select model for SUBAGENTS (debug, coder, testing, security, devops, audit):
  Claude 3.5 Haiku   (anthropic)     Fast and cost-effective
  o4 Mini            (openai)        Fast reasoning, cost-effective
  Gemini 2.5 Flash   (google)        Fast and efficient
  Same as primary
```

### In-Agent Configuration

Agents can also configure models during a session via the `cortex_configure` tool — no need to leave OpenCode. The agent will prompt you to select models when `.cortex/` is first initialized.

### Per-Project vs Global

| Scope | Where | Use Case |
|-------|-------|----------|
| **Global** | `~/.config/opencode/opencode.json` | Default for all projects |
| **Per-project** | `.opencode/models.json` + `opencode.json` | Different models for different repos |

Per-project config takes priority. Team members get the same model settings when they clone the repo (`.opencode/models.json` is git-tracked).

### Supported Providers

| Provider | Premium | Standard | Fast |
|----------|---------|----------|------|
| **Anthropic** | Claude Opus 4 | Claude Sonnet 4 | Claude 3.5 Haiku |
| **OpenAI** | o3 | GPT-4.1 | o4 Mini |
| **Google** | Gemini 2.5 Pro | - | Gemini 2.5 Flash |
| **xAI** | Grok 3 | - | Grok 3 Mini |
| **DeepSeek** | DeepSeek R1 | - | DeepSeek Chat |
| **Kimi** | - | Kimi K2P5 | - |

> Don't see your provider? Select **"Enter custom model ID"** and type any `provider/model` string.

<br>

## Project Structure

```
your-project/
  .cortex/                     Project context (auto-initialized)
     config.json              Configuration
     plans/                   Implementation plans (gitignored)
     sessions/                Session summaries (gitignored)
     repl-state.json          REPL loop progress (gitignored, auto-managed)
  .opencode/
     models.json              Per-project model config (git tracked)
  .worktrees/                  Git worktrees (gitignored)
     feature-auth/            Isolated development copy
     bugfix-login/
  docs/                        Documentation (git tracked)
     INDEX.md                 Auto-generated index
     decisions/               Architecture Decision Records
     features/                Feature docs with diagrams
     flows/                   Process/data flow docs
```

<br>

## CLI Reference

```bash
npx cortex-agents install                      # Install plugin, agents, and skills
npx cortex-agents configure                    # Global model selection
npx cortex-agents configure --project          # Per-project model selection
npx cortex-agents configure --reset            # Reset global models
npx cortex-agents configure --project --reset  # Reset per-project models
npx cortex-agents uninstall                    # Clean removal of everything
npx cortex-agents status                       # Show installation and model status
```

<br>

## How It Works

### The Implement Agent Workflow

Every time the implement agent starts, it follows a structured pre-implementation checklist:

```
Step 1   branch_status           Am I on a protected branch?
Step 2   cortex_status           Is .cortex initialized? Offer model config if new project.
Step 3   plan_list / plan_load   Is there a plan for this work?
Step 4   Ask: strategy           Worktree (recommended) or branch?
Step 5   Execute                 Create worktree/branch
Step 6   REPL Loop               If plan loaded: repl_init → iterate tasks one-by-one
  6a     repl_init               Parse plan tasks + acceptance criteria, auto-detect build/test
  6b     repl_status             Get current task with ACs, auto-advance from pending
  6c     Implement task          Write code to satisfy acceptance criteria
  6d     Build + test            Run detected build/test commands
  6e     repl_report             Report pass/fail/skip → auto-advance or retry
  6f     Repeat 6b-6e            Until all tasks done or user intervenes
Step 7   Quality Gate            Launch @testing + @security + @audit in parallel (+ repl_summary)
Step 8   Ask: documentation      Decision doc / feature doc / flow doc?
Step 9   session_save            Record what was done and why
Step 10  task_finalize           Commit, push, create PR
Step 11  Ask: cleanup            Remove worktree? (if applicable)
```

This isn't just documentation - it's enforced by the agent's instructions. The AI follows this workflow every time.

### Sub-Agent Quality Gates

After implementation (Step 7), the implement agent **automatically** launches sub-agents in parallel as quality gates:

```
Implement Agent completes implementation
   |
   +-- launches in parallel (single message) -----+------------------+
   |                                               |                  |
   v                                               v                  v
@testing                                      @security            @audit
  Writes unit tests                             OWASP audit          Code quality
  Runs test suite                               Secrets scan         Tech debt score
  Reports coverage                              Severity ratings     Pattern review
  Returns: PASS/FAIL                            Returns: PASS/FAIL   Returns: A-F grade
   |                                               |                  |
   +------------- results reviewed by Implement ---+------------------+
   |
   v
Quality Gate Summary included in PR body
```

The fix agent uses a similar pattern: `@testing` for regression tests (always) and `@security` when the fix touches sensitive code. Complex issues are delegated to `@debug` for root cause analysis before fixing.

Sub-agents use **structured return contracts** so results are actionable:
- `BLOCKING` / `CRITICAL` / `HIGH` findings block finalization
- `MEDIUM` findings are noted in the PR body
- `LOW` findings are deferred

### REPL Loop (Iterative Implementation)

When a plan is loaded, the implement agent activates a **Read-Eval-Print Loop** that works through tasks one at a time with build+test verification after each:

```
repl_init("my-plan.md")
  → Parses plan tasks (- [ ] checkboxes) with acceptance criteria (- AC: lines)
  → Auto-detects: npm run build, npx vitest run (vitest)
  → Creates .cortex/repl-state.json

Loop:
  repl_status                    → "Task #1: Implement user model"
                                    Acceptance Criteria:
                                      - User model schema includes name, email, password
                                      - Email validation rejects malformed addresses
  [agent implements task]
  [agent runs build + tests]
  repl_report(pass, "42 tests pass")  → "✓ Task #1 PASSED (1st attempt)"
                                       → "→ Next: Task #2"

  repl_status                    → "Task #2: Add API endpoints"
  [agent implements task]
  [agent runs build + tests]
  repl_report(fail, "POST /users 500") → "⚠ Task #2 FAILED (attempt 1/3)"
                                        → "Fix and retry. 2 retries remaining."
  [agent fixes the issue]
  [agent runs build + tests]
  repl_report(pass, "All green")  → "✓ Task #2 PASSED (2nd attempt)"
                                   → "→ Next: Task #3"
  ...

repl_summary                     → Markdown table with AC satisfaction for PR body
```

**Plan AC format** (used by Architect when creating plans):
```markdown
## Tasks
- [ ] Task 1: Implement user model
  - AC: User model schema includes name, email, password fields
  - AC: Email validation rejects malformed addresses
  - AC: Passwords hashed with bcrypt before storage
- [ ] Task 2: Add API endpoints
  - AC: POST /users returns 201 on success
```

**Key behaviors:**
- **Opt-in**: Only activates when a plan is loaded. No-plan sessions use the standard linear workflow.
- **Acceptance criteria**: Each task can have `- AC:` lines that are displayed during implementation and tracked in the summary.
- **Auto-detection**: Scans `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `Makefile`, `mix.exs` for build/test/lint commands.
- **Retry with escalation**: Failed tasks retry up to `maxRetries` (default: 3) before asking the user how to proceed.
- **Persistent state**: Progress saved to `.cortex/repl-state.json` — survives context compaction, session restarts, and agent switches.
- **Skip support**: Tasks can be skipped with a reason, which is tracked in the summary.

### Agent Handover

When agents switch, a toast notification tells you what mode you're in:

```
Agent: architect             Planning mode — read-only analysis
Agent: implement             Development mode — ready to implement
Agent: fix                   Quick fix mode — fast turnaround
```

The Architect agent is the entry point — it creates plans with mermaid diagrams, acceptance criteria, and hands off to Implement. Implement loads the plan, detects the tech stack, loads relevant skills, and implements task by task. If something breaks, Fix takes over for quick turnaround, delegating deep debugging to the @debug sub-agent when needed.

<br>

## Requirements

- [OpenCode](https://opencode.ai) >= 1.0.0
- Node.js >= 18.0.0
- Git (for branch/worktree features)
- [GitHub CLI](https://cli.github.com/) (optional, for `task_finalize` PR creation and `github_*` tools)

<br>

## Contributing

Contributions are welcome! This is an Apache-2.0 licensed project and we'd love your help.

### Getting Started

```bash
git clone https://github.com/ps-carvalho/cortex-agents.git
cd cortex-agents
npm install
npm run build
```

### Development Workflow

```bash
# Link for local testing
npm link
cd ~/.config/opencode && npm link cortex-agents

# Make changes, rebuild, restart OpenCode
npm run build

# Unlink when done
cd ~/.config/opencode && npm unlink cortex-agents && npm install
```

### What We're Looking For

- **New skills** - Domain-specific knowledge packs (e.g., Rust, Go, DevOps for AWS)
- **New agents** - Specialized agents (e.g., reviewer, migration, docs-writer)
- **Tool improvements** - Better PR templates, test runners, linter integration
- **Bug fixes** - Anything that doesn't work as expected

### Submitting Changes

1. Fork the repository
2. Create your branch (`git checkout -b feature/amazing-feature`)
3. Commit with conventional format (`git commit -m 'feat: add amazing feature'`)
4. Push and open a Pull Request

<br>

## License

[Apache-2.0](LICENSE)

<br>

<p align="center">
  <sub>Built for the <a href="https://opencode.ai">OpenCode</a> community</sub>
</p>
