# cortex-agents

<p align="center">
  <strong>Model-agnostic agents for OpenCode with interactive model configuration, worktree workflow, and plan persistence</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cortex-agents">
    <img src="https://img.shields.io/npm/v/cortex-agents.svg?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/cortex-agents">
    <img src="https://img.shields.io/npm/dm/cortex-agents.svg?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/your-org/cortex-agents/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/cortex-agents.svg?style=flat-square" alt="license">
  </a>
  <a href="https://opencode.ai">
    <img src="https://img.shields.io/badge/OpenCode-Plugin-blue?style=flat-square" alt="OpenCode Plugin">
  </a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#model-configuration">Model Configuration</a> •
  <a href="#features">Features</a> •
  <a href="#agents">Agents</a> •
  <a href="#tools">Tools</a>
</p>

---

## Quick Start

```bash
# 1. Install the plugin
npx cortex-agents install

# 2. Choose your models interactively
npx cortex-agents configure

# 3. Restart OpenCode — done!
```

---

## Model Configuration

Cortex agents are **model-agnostic**. You choose which models to use by running the interactive configure command:

```bash
npx cortex-agents configure
```

You'll be prompted to select:

1. **Primary model** — for `build`, `plan`, and `debug` agents (complex tasks)
2. **Subagent model** — for `fullstack`, `testing`, `security`, and `devops` agents (focused tasks)

### Example

```
$ npx cortex-agents configure

🔧 Cortex Agents — Model Configuration

Primary agents (build, plan, debug) handle complex tasks.
Use your best available model.

? Select model for PRIMARY agents:
❯ Claude Sonnet 4    (anthropic)   Best balance of intelligence and speed
  Claude Opus 4      (anthropic)   Most capable, best for complex architecture
  GPT-4.1            (openai)      Fast multimodal model
  o3                 (openai)      Advanced reasoning model
  Gemini 2.5 Pro     (google)      Large context window, strong reasoning
  Kimi K2P5          (kimi)        Optimized for code generation
  Enter custom model ID

✓ Primary model: anthropic/claude-sonnet-4-20250514

? Select model for SUBAGENTS:
❯ Claude 3.5 Haiku   (anthropic)   Fast and cost-effective for focused tasks
  o4 Mini            (openai)      Fast reasoning, cost-effective
  Gemini 2.5 Flash   (google)      Fast and efficient
  Same as primary
  Enter custom model ID

✓ Subagent model: anthropic/claude-haiku-3.5

✓ Configuration saved to ~/.config/opencode/opencode.json
```

### Supported Providers

| Provider | Premium | Standard | Fast |
|----------|---------|----------|------|
| **Anthropic** | Claude Opus 4 | Claude Sonnet 4 | Claude 3.5 Haiku |
| **OpenAI** | o3 | GPT-4.1 | o4 Mini |
| **Google** | Gemini 2.5 Pro | — | Gemini 2.5 Flash |
| **xAI** | Grok 3 | — | Grok 3 Mini |
| **DeepSeek** | DeepSeek R1 | — | DeepSeek Chat |
| **Kimi** | — | Kimi K2P5 | — |

> Don't see your provider? Select **"Enter custom model ID"** and enter any `provider/model` identifier.

### Reconfigure or Reset

```bash
# Change models at any time
npx cortex-agents configure

# Reset to OpenCode defaults (removes model config)
npx cortex-agents configure --reset
```

---

## Features

- 🤖 **Model-Agnostic** — Works with any provider: Anthropic, OpenAI, Google, xAI, DeepSeek, Kimi, and more
- 🔧 **Interactive Configuration** — `npx cortex-agents configure` to select models with arrow-key menus
- 🌳 **Worktree Workflow** — Create isolated development environments with git worktrees
- 📋 **Plan Persistence** — Save implementation plans with mermaid diagrams to `.cortex/plans/`
- 📝 **Session Management** — Record key decisions and context in `.cortex/sessions/`
- 🔄 **Pre-Implementation Workflow** — Agents ask about branch/worktree strategy before making changes
- 🎯 **Agent Handoff** — Seamless transition between Plan → Build → Debug agents
- 📚 **Skills System** — Domain-specific knowledge for web dev, testing, security, and more

---

## Installation

### Option 1: Add to OpenCode Config (Recommended)

Add the plugin to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["cortex-agents"]
}
```

Then configure your models:

```bash
npx cortex-agents configure
```

### Option 2: Use the CLI Helper

```bash
# Install and configure
npx cortex-agents install
npx cortex-agents configure
```

### Option 3: Global npm Install

```bash
npm install -g cortex-agents
cortex-agents install
cortex-agents configure
```

---

## CLI Commands

```bash
npx cortex-agents install              # Add plugin to opencode.json
npx cortex-agents configure            # Interactive model selection
npx cortex-agents configure --reset    # Reset to OpenCode default models
npx cortex-agents uninstall            # Remove plugin, agents, skills, and model config
npx cortex-agents status               # Show installation and model status
npx cortex-agents help                 # Show help
```

---

## Agents

### Primary Agents

These agents handle complex tasks and use your **primary model**:

| Agent | Description | Best For |
|-------|-------------|----------|
| **build** | Full-access development with branch/worktree workflow | Implementing features, refactoring |
| **plan** | Read-only analysis with plan persistence and handoff | Architecture decisions, complex planning |
| **debug** | Deep troubleshooting with hotfix workflow | Bug fixes, production issues |

### Subagents (@mention)

These agents handle focused tasks and use your **subagent model**:

| Agent | Description |
|-------|-------------|
| **@fullstack** | End-to-end feature implementation across frontend and backend |
| **@testing** | Test writing, coverage analysis, and test strategy |
| **@security** | Security audit and vulnerability detection |
| **@devops** | CI/CD pipelines and deployment automation |

---

## Tools

All tools are bundled with the plugin and available automatically.

### Cortex Management
- `cortex_init` - Initialize `.cortex` directory with config and templates
- `cortex_status` - Check cortex status (exists, plan count, session count)

### Worktree Management
- `worktree_create <name> <type>` - Create worktree in `../.worktrees/`
- `worktree_list` - List all worktrees
- `worktree_remove <name>` - Remove worktree (after merging)
- `worktree_open <name>` - Get command to open terminal in worktree

### Branch Management
- `branch_create <name> <type>` - Create feature/bugfix/hotfix/refactor/docs/test branch
- `branch_status` - Get current branch, check for uncommitted changes, detect protected branches
- `branch_switch <branch>` - Switch to existing branch

### Plan Management
- `plan_save <title> <type> <content>` - Save plan to `.cortex/plans/`
- `plan_list [type]` - List saved plans (optionally filter by type)
- `plan_load <filename>` - Load a plan
- `plan_delete <filename>` - Delete a plan

### Session Management
- `session_save <summary> [decisions]` - Save session summary with key decisions
- `session_list [limit]` - List recent sessions
- `session_load <filename>` - Load a session summary

---

## Skills

Load domain-specific knowledge with the `skill` tool:

| Skill | Description |
|-------|-------------|
| **git-workflow** | Branching strategies, worktree management, collaborative workflows |
| **web-development** | Full-stack patterns and best practices |
| **testing-strategies** | Comprehensive testing approaches |
| **security-hardening** | Security best practices and patterns |
| **deployment-automation** | CI/CD pipelines and infrastructure |
| **code-quality** | Refactoring patterns and maintainability |

---

## Workflow Example

### Feature Development

```
User: "I want to add user authentication"

Plan Agent:
├── Analyzes codebase structure
├── Creates implementation plan with mermaid diagrams
├── Saves to .cortex/plans/2024-02-22-feature-user-auth.md
└── Asks: "Plan saved. Switch to Build agent?"

User: "Yes"

Build Agent:
├── Loads plan from .cortex/plans/
├── Checks git status (detects protected branch)
├── Asks: "Create branch or worktree?"
├── Creates feature/user-authentication
├── Implements following the plan
└── Saves session summary with key decisions
```

---

## Configuration

### opencode.json (after running `configure`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["cortex-agents"],
  "agent": {
    "build": { "model": "anthropic/claude-sonnet-4-20250514" },
    "plan": { "model": "anthropic/claude-sonnet-4-20250514" },
    "debug": { "model": "anthropic/claude-sonnet-4-20250514" },
    "fullstack": { "model": "anthropic/claude-haiku-3.5" },
    "testing": { "model": "anthropic/claude-haiku-3.5" },
    "security": { "model": "anthropic/claude-haiku-3.5" },
    "devops": { "model": "anthropic/claude-haiku-3.5" }
  }
}
```

> Power users can edit `opencode.json` directly for per-agent model control.

### .cortex Directory

```
<project-root>/
└── .cortex/
    ├── config.json         # Project configuration
    ├── .gitignore          # Ignores sessions/, keeps plans/
    ├── plans/              # Implementation plans (git tracked)
    │   └── YYYY-MM-DD-type-slug.md
    └── sessions/           # Session summaries (gitignored)
        └── YYYY-MM-DD-session-id.md
```

---

## Branch Naming Convention

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feature/` | `feature/user-authentication` |
| Bugfix | `bugfix/` | `bugfix/login-validation` |
| Hotfix | `hotfix/` | `hotfix/security-patch` |
| Refactor | `refactor/` | `refactor/api-cleanup` |
| Docs | `docs/` | `docs/api-reference` |
| Test | `test/` | `test/e2e-coverage` |

---

## Requirements

- **OpenCode**: >= 1.0.0
- **Node.js**: >= 18.0.0
- **Git**: For branch and worktree features

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

[Apache-2.0](LICENSE) © OpenCode Contributors

---

<p align="center">
  Built for the <a href="https://opencode.ai">OpenCode</a> community
</p>
