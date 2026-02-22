# cortex-agents

<p align="center">
  <strong>Enhanced agents for OpenCode with k2p5 model, worktree workflow, and plan persistence</strong>
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
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#agents">Agents</a> •
  <a href="#tools">Tools</a>
</p>

---

## Quick Start

```bash
# 1. Install the plugin
npx cortex-agents install

# 2. Initialize cortex in your project
cortex_init

# 3. Check your setup
cortex_status
```

That's it! The enhanced agents are now available in OpenCode.

---

## Features

- 🌳 **Worktree Workflow** - Create isolated development environments with git worktrees
- 📋 **Plan Persistence** - Save implementation plans with mermaid diagrams to `.cortex/plans/`
- 📝 **Session Management** - Record key decisions and context in `.cortex/sessions/`
- 🔄 **Pre-Implementation Workflow** - Agents ask about branch/worktree strategy before making changes
- 🎯 **Agent Handoff** - Seamless transition between Plan → Build → Debug agents
- 🔧 **Git Integration** - Built-in branch and worktree management tools
- 📚 **Skills System** - Domain-specific knowledge for web dev, testing, security, and more

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

OpenCode will auto-install via Bun at startup.

### Option 2: Use the CLI Helper

```bash
# Install and configure
npx cortex-agents install

# Check status
npx cortex-agents status
```

This adds the plugin to your global `~/.config/opencode/opencode.json`.

### Option 3: Global npm Install

```bash
# Install globally
npm install -g cortex-agents

# Configure
cortex-agents install
```

---

## Usage

### CLI Commands

```bash
npx cortex-agents install       # Add to opencode.json config
npx cortex-agents uninstall     # Remove from config
npx cortex-agents status        # Check installation status
npx cortex-agents help          # Show help
```

### Basic Workflow

```bash
# Initialize cortex in your project
cortex_init

# Check your branch status
branch_status

# Create a feature branch or worktree
branch_create my-feature feature
# or
worktree_create my-feature feature

# Save an implementation plan
plan_save "Add user authentication" feature "- [ ] Setup auth middleware
- [ ] Create login endpoint
- [ ] Add session management"

# List all plans
plan_list

# After completing work, save session summary
session_save "Implemented OAuth2 authentication" ["Used Passport.js" "JWT tokens for sessions"]
```

---

## Agents

### Primary Agents

These agents are automatically enhanced when you install cortex-agents:

| Agent | Description | Best For |
|-------|-------------|----------|
| **build** | Full-access development with branch/worktree workflow | Implementing features, refactoring |
| **plan** | Read-only analysis with plan persistence and handoff | Architecture decisions, complex planning |
| **debug** | Deep troubleshooting with hotfix workflow | Bug fixes, production issues |

### Subagents (@mention)

Call specialized subagents for specific tasks:

| Agent | Description |
|-------|-------------|
| **@fullstack** | End-to-end feature implementation across frontend and backend |
| **@testing** | Test writing, coverage analysis, and test strategy |
| **@security** | Security audit and vulnerability detection |
| **@devops** | CI/CD pipelines and deployment automation |

---

## Tools

All tools are bundled with the plugin and available automatically.

### 🧠 Cortex Management

Manage your project's `.cortex` directory:

- `cortex_init` - Initialize `.cortex` directory with config and templates
- `cortex_status` - Check cortex status (exists, plan count, session count)

### 🌳 Worktree Management

Work in parallel with git worktrees:

- `worktree_create <name> <type>` - Create worktree in `../.worktrees/`
- `worktree_list` - List all worktrees
- `worktree_remove <name>` - Remove worktree (after merging)
- `worktree_open <name>` - Get command to open terminal in worktree

### 🌿 Branch Management

Streamlined git branch operations:

- `branch_create <name> <type>` - Create feature/bugfix/hotfix/refactor/docs/test branch
- `branch_status` - Get current branch, check for uncommitted changes, detect protected branches
- `branch_switch <branch>` - Switch to existing branch

### 📋 Plan Management

Persist implementation plans:

- `plan_save <title> <type> <content>` - Save plan to `.cortex/plans/`
- `plan_list [type]` - List saved plans (optionally filter by type)
- `plan_load <filename>` - Load a plan
- `plan_delete <filename>` - Delete a plan

### 📝 Session Management

Record session summaries:

- `session_save <summary> [decisions]` - Save session summary with key decisions
- `session_list [limit]` - List recent sessions
- `session_load <filename>` - Load a session summary

---

## Skills

Load domain-specific knowledge with the `skill` tool:

| Skill | Description | File |
|-------|-------------|------|
| **git-workflow** | Branching strategies, worktree management, collaborative workflows | `git-workflow/SKILL.md` |
| **web-development** | Full-stack patterns and best practices | `web-development/SKILL.md` |
| **testing-strategies** | Comprehensive testing approaches | `testing-strategies/SKILL.md` |
| **security-hardening** | Security best practices and patterns | `security-hardening/SKILL.md` |
| **deployment-automation** | CI/CD pipelines and infrastructure | `deployment-automation/SKILL.md` |
| **code-quality** | Refactoring patterns and maintainability | `code-quality/SKILL.md` |

**Usage:**
```
skill("git-workflow")
```

---

## Workflow Example

### Feature Development

```
User: "I want to add user authentication"

Plan Agent (read-only):
├── Analyzes codebase structure
├── Creates implementation plan with mermaid diagrams
├── Saves to .cortex/plans/2024-02-22-feature-user-auth.md
└── Asks: "Plan saved. Switch to Build agent?"

User: "Yes"

Build Agent:
├── Loads plan from .cortex/plans/
├── Checks git status (detects on main branch)
├── Asks: "Create branch or worktree?"
├── User: "Create branch"
├── Creates feature/user-authentication
├── Implements following the plan
└── Saves session summary with key decisions
```

### Hotfix with Worktree

```
User: "Fix the critical login bug"

debug Agent:
├── Detects protected branch (main)
├── Creates worktree: hotfix/login-bug
├── Opens new terminal in worktree
├── Fixes the bug
├── Commits and pushes
├── Removes worktree after merge
└── Records session summary
```

---

## .cortex Directory Structure

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

| Type | Prefix | Example | Use Case |
|------|--------|---------|----------|
| Feature | `feature/` | `feature/user-authentication` | New functionality |
| Bugfix | `bugfix/` | `bugfix/login-validation` | Non-critical bugs |
| Hotfix | `hotfix/` | `hotfix/security-patch` | Critical production fixes |
| Refactor | `refactor/` | `refactor/api-cleanup` | Code restructuring |
| Docs | `docs/` | `docs/api-reference` | Documentation only |
| Test | `test/` | `test/e2e-coverage` | Test additions |

---

## Configuration

### Default Settings

- **Default Model**: `kimi-for-coding/k2p5`
- **Worktree Location**: `../.worktrees/`
- **Plans Directory**: `.cortex/plans/`
- **Sessions Directory**: `.cortex/sessions/`

### opencode.json Example

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["cortex-agents"],
  "model": "kimi-for-coding/k2p5"
}
```

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

Please make sure to update tests as appropriate and follow the existing code style.

---

## License

[Apache-2.0](LICENSE) © OpenCode Contributors

---

## Support

- 📖 [Documentation](https://github.com/your-org/cortex-agents#readme)
- 🐛 [Issue Tracker](https://github.com/your-org/cortex-agents/issues)
- 💬 [Discussions](https://github.com/your-org/cortex-agents/discussions)

---

<p align="center">
  Built with ❤️ for the <a href="https://opencode.ai">OpenCode</a> community
</p>
