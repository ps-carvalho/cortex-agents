import { tool } from "@opencode-ai/plugin";

const PROTECTED_BRANCHES = ["main", "master", "develop", "production", "staging"];

export const create = tool({
  description:
    "Create and checkout a new git branch with proper naming convention",
  args: {
    name: tool.schema
      .string()
      .describe("Branch name slug (e.g., 'user-authentication', 'fix-login')"),
    type: tool.schema
      .enum(["feature", "bugfix", "hotfix", "refactor", "docs", "test", "chore"])
      .describe("Branch type - determines prefix"),
  },
  async execute(args, context) {
    const { name, type } = args;
    const branchName = `${type}/${name}`;

    // Check if we're in a git repository
    try {
      await Bun.$`git rev-parse --git-dir`.cwd(context.worktree).text();
    } catch {
      return "✗ Error: Not in a git repository";
    }

    // Check if branch already exists
    try {
      const branches = await Bun.$`git branch --list ${branchName}`.cwd(context.worktree).text();
      if (branches.trim()) {
        return `✗ Error: Branch '${branchName}' already exists.

Use branch_switch to switch to it, or choose a different name.`;
      }
    } catch {
      // Ignore error, branch check is optional
    }

    // Create and checkout the branch
    try {
      await Bun.$`git checkout -b ${branchName}`.cwd(context.worktree);
    } catch (error: any) {
      return `✗ Error creating branch: ${error.message || error}`;
    }

    return `✓ Created and switched to branch: ${branchName}

You are now on branch '${branchName}'.
Make your changes and commit when ready.`;
  },
});

export const status = tool({
  description:
    "Get current git branch status - branch name, uncommitted changes, and whether on protected branch",
  args: {},
  async execute(args, context) {
    // Check if we're in a git repository
    try {
      await Bun.$`git rev-parse --git-dir`.cwd(context.worktree).text();
    } catch {
      return "✗ Not in a git repository";
    }

    let currentBranch = "";
    let hasChanges = false;
    let stagedChanges = false;
    let untrackedFiles = false;
    let isProtected = false;
    let aheadBehind = "";

    // Get current branch
    try {
      currentBranch = (await Bun.$`git branch --show-current`.cwd(context.worktree).text()).trim();
      if (!currentBranch) {
        currentBranch = "(detached HEAD)";
      }
    } catch {
      currentBranch = "(unknown)";
    }

    // Check if protected
    isProtected = PROTECTED_BRANCHES.includes(currentBranch);

    // Check for changes
    try {
      const statusOutput = await Bun.$`git status --porcelain`.cwd(context.worktree).text();
      const lines = statusOutput.trim().split("\n").filter((l) => l);
      
      for (const line of lines) {
        const status = line.substring(0, 2);
        if (status[0] !== " " && status[0] !== "?") {
          stagedChanges = true;
        }
        if (status[1] !== " " && status[1] !== "?") {
          hasChanges = true;
        }
        if (status === "??") {
          untrackedFiles = true;
        }
      }
    } catch {
      // Ignore error
    }

    // Check ahead/behind
    try {
      const result = await Bun.$`git rev-list --left-right --count HEAD...@{upstream}`.cwd(context.worktree).text();
      const [ahead, behind] = result.trim().split(/\s+/);
      if (parseInt(ahead) > 0 || parseInt(behind) > 0) {
        aheadBehind = `Ahead: ${ahead}, Behind: ${behind}`;
      }
    } catch {
      // No upstream or error
    }

    // Build output
    let output = `Git Status:

Branch: ${currentBranch}`;

    if (isProtected) {
      output += ` ⚠️  PROTECTED`;
    }

    output += `\n`;

    if (stagedChanges || hasChanges || untrackedFiles) {
      output += `\nChanges:`;
      if (stagedChanges) output += `\n  • Staged changes (ready to commit)`;
      if (hasChanges) output += `\n  • Unstaged changes`;
      if (untrackedFiles) output += `\n  • Untracked files`;
    } else {
      output += `\nWorking tree clean.`;
    }

    if (aheadBehind) {
      output += `\n\n${aheadBehind}`;
    }

    if (isProtected) {
      output += `\n
⚠️  You are on a protected branch (${currentBranch}).
    Consider creating a feature/bugfix branch before making changes.
    Use branch_create or worktree_create.`;
    }

    return output;
  },
});

export const switch_ = tool({
  description: "Switch to an existing git branch",
  args: {
    branch: tool.schema.string().describe("Branch name to switch to"),
  },
  async execute(args, context) {
    const { branch } = args;

    // Check if branch exists
    try {
      const branches = await Bun.$`git branch --list ${branch}`.cwd(context.worktree).text();
      if (!branches.trim()) {
        // Try remote branch
        const remoteBranches = await Bun.$`git branch -r --list origin/${branch}`.cwd(context.worktree).text();
        if (!remoteBranches.trim()) {
          return `✗ Error: Branch '${branch}' not found locally or on origin.

Use branch_create to create a new branch.`;
        }
      }
    } catch {
      // Ignore error, try checkout anyway
    }

    // Switch to branch
    try {
      await Bun.$`git checkout ${branch}`.cwd(context.worktree);
    } catch (error: any) {
      return `✗ Error switching branch: ${error.message || error}

You may have uncommitted changes. Commit or stash them first.`;
    }

    return `✓ Switched to branch: ${branch}`;
  },
});

// Export with underscore suffix to avoid reserved word
export { switch_ as switch };
