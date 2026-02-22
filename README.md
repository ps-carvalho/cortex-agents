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

That's it. Your OpenCode session now has 7 specialized agents, 22 tools, and 14 domain skills.

<br>

## What It Does

### Plan, Build, Ship

Cortex agents follow a structured workflow from planning through to PR:

```
You: "Add user authentication"

Plan Agent                              reads codebase, creates plan with mermaid diagrams
   saves to .cortex/plans/             "Plan saved. Switch to Build?"

Build Agent                             loads plan, checks git status
   "You're on main. Create a branch     two-step prompt: strategy -> execution
    or worktree?"
   creates feature/user-auth            implements following the plan
   "Ready to finalize?"                 stages, commits, pushes, opens PR
```

### Worktree Launcher

Create isolated development environments and launch them instantly:

| Mode | What Happens |
|------|-------------|
| **New Terminal** | Opens a new terminal tab with OpenCode pre-configured in the worktree |
| **In-App PTY** | Spawns an embedded terminal inside your current OpenCode session |
| **Background** | AI implements headlessly while you keep working - toast notifications on completion |

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

### Primary Agents

Handle complex, multi-step work. Use your best model.

| Agent | Role | Superpower |
|-------|------|-----------|
| **build** | Full-access development | Two-step branching strategy, worktree launcher, task finalizer, docs prompting |
| **plan** | Read-only analysis | Creates implementation plans with mermaid diagrams, hands off to build |
| **debug** | Deep troubleshooting | Full bash/edit access with hotfix workflow |

### Subagents

Focused specialists. Invoked with `@mention`. Use a fast/cheap model.

| Agent | Role |
|-------|------|
| **@fullstack** | End-to-end feature implementation across frontend + backend |
| **@testing** | Test writing, coverage analysis, TDD workflow |
| **@security** | Vulnerability scanning, secure coding review |
| **@devops** | CI/CD pipelines, Docker, deployment automation |

<br>

## Tools

22 tools bundled and auto-registered. No configuration needed.

<table>
<tr><td width="50%">

**Git Workflow**
- `branch_status` - Current branch + change detection
- `branch_create` - Convention-named branches
- `branch_switch` - Safe branch switching
- `worktree_create` - Isolated worktree in `.worktrees/`
- `worktree_launch` - Launch worktree (terminal/PTY/background)
- `worktree_list` / `worktree_remove` / `worktree_open`

</td><td width="50%">

**Planning & Sessions**
- `plan_save` / `plan_load` / `plan_list` / `plan_delete`
- `session_save` / `session_list` / `session_load`
- `cortex_init` / `cortex_status`

</td></tr>
<tr><td width="50%">

**Documentation**
- `docs_init` - Set up `docs/` structure
- `docs_save` - Save doc with mermaid diagrams
- `docs_list` - Browse all docs
- `docs_index` - Rebuild `docs/INDEX.md`

</td><td width="50%">

**Finalization**
- `task_finalize` - Stage, commit, push, create PR
  - Auto-detects worktree (targets main)
  - Auto-populates PR from `.cortex/plans/`
  - Warns if docs are missing

</td></tr>
</table>

<br>

## Skills

14 domain-specific skill packs loaded on demand via the `skill` tool:

| Skill | Covers |
|-------|--------|
| **web-development** | Full-stack patterns, REST/GraphQL, SSR, state management |
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

Cortex agents are **model-agnostic**. Pick any provider:

```bash
npx cortex-agents configure
```

```
? Select model for PRIMARY agents:
  Claude Sonnet 4    (anthropic)     Best balance of intelligence and speed
  Claude Opus 4      (anthropic)     Most capable, best for complex architecture
  GPT-4.1            (openai)        Fast multimodal model
  Gemini 2.5 Pro     (google)        Large context window, strong reasoning
  Kimi K2P5          (kimi)          Optimized for code generation
  Enter custom model ID

? Select model for SUBAGENTS:
  Claude 3.5 Haiku   (anthropic)     Fast and cost-effective
  o4 Mini            (openai)        Fast reasoning, cost-effective
  Gemini 2.5 Flash   (google)        Fast and efficient
  Same as primary
```

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
     plans/                   Implementation plans (git tracked)
     sessions/                Session summaries (gitignored)
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
npx cortex-agents install              # Install plugin, agents, and skills
npx cortex-agents configure            # Interactive model selection
npx cortex-agents configure --reset    # Reset to OpenCode defaults
npx cortex-agents uninstall            # Clean removal of everything
npx cortex-agents status               # Show installation status
```

<br>

## How It Works

### The Build Agent Workflow

Every time the build agent starts, it follows a structured pre-implementation checklist:

```
Step 1   branch_status           Am I on a protected branch?
Step 2   cortex_status           Is .cortex initialized?
Step 3   plan_list / plan_load   Is there a plan for this work?
Step 4   Ask: strategy           Branch or worktree?
Step 4b  Ask: launch mode        Stay / terminal / PTY / background?
Step 5   Execute                 Create branch or launch worktree
Step 6   Implement               Write code following the plan
Step 7   Ask: documentation      Decision doc / feature doc / flow doc?
Step 8   session_save            Record what was done and why
Step 9   task_finalize           Commit, push, create PR
Step 10  Ask: cleanup            Remove worktree? (if applicable)
```

This isn't just documentation - it's enforced by the agent's instructions. The AI follows this workflow every time.

### Agent Handover

When agents switch, a toast notification tells you what mode you're in:

```
Agent: build                 Development mode - ready to implement
Agent: plan                  Planning mode - read-only analysis
Agent: debug                 Debug mode - troubleshooting and fixes
```

The Plan agent creates plans with mermaid diagrams and hands off to Build. Build loads the plan and implements it. If something breaks, Debug takes over with full access.

<br>

## Requirements

- [OpenCode](https://opencode.ai) >= 1.0.0
- Node.js >= 18.0.0
- Git (for branch/worktree features)
- [GitHub CLI](https://cli.github.com/) (optional, for `task_finalize` PR creation)

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
- **Platform support** - Improve terminal detection for Linux/Windows
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
