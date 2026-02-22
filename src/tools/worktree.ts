import { tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";

const WORKTREE_ROOT = "../.worktrees";

export const create = tool({
  description:
    "Create a new git worktree for isolated development. Worktrees are created in ../.worktrees/",
  args: {
    name: tool.schema
      .string()
      .describe("Worktree name (e.g., 'auth-feature', 'login-bugfix')"),
    type: tool.schema
      .enum(["feature", "bugfix", "hotfix", "refactor", "spike", "docs", "test"])
      .describe("Type of work - determines branch prefix"),
  },
  async execute(args, context) {
    const { name, type } = args;
    const branchName = `${type}/${name}`;
    const worktreePath = path.join(context.worktree, WORKTREE_ROOT, name);
    const absoluteWorktreePath = path.resolve(worktreePath);

    // Check if we're in a git repository
    try {
      const gitCheck = await Bun.$`git rev-parse --git-dir`.cwd(context.worktree).text();
      if (!gitCheck.trim()) {
        return "✗ Error: Not in a git repository";
      }
    } catch {
      return "✗ Error: Not in a git repository. Initialize git first.";
    }

    // Check if worktree already exists
    if (fs.existsSync(absoluteWorktreePath)) {
      return `✗ Error: Worktree already exists at ${absoluteWorktreePath}

Use worktree_list to see existing worktrees.`;
    }

    // Create parent directory if needed
    const worktreeParent = path.dirname(absoluteWorktreePath);
    if (!fs.existsSync(worktreeParent)) {
      fs.mkdirSync(worktreeParent, { recursive: true });
    }

    // Create the worktree with a new branch
    try {
      await Bun.$`git worktree add -b ${branchName} ${absoluteWorktreePath}`.cwd(context.worktree);
    } catch (error: any) {
      // Branch might already exist, try without -b
      try {
        await Bun.$`git worktree add ${absoluteWorktreePath} ${branchName}`.cwd(context.worktree);
      } catch (error2: any) {
        return `✗ Error creating worktree: ${error2.message || error2}`;
      }
    }

    return `✓ Created worktree successfully

Branch: ${branchName}
Path: ${absoluteWorktreePath}

To work in this worktree:
  cd ${absoluteWorktreePath}

Or use worktree_open to get a command to open a new terminal there.`;
  },
});

export const list = tool({
  description: "List all git worktrees for this project",
  args: {},
  async execute(args, context) {
    try {
      const result = await Bun.$`git worktree list`.cwd(context.worktree).text();
      
      if (!result.trim()) {
        return "No worktrees found.";
      }

      const lines = result.trim().split("\n");
      let output = "Git Worktrees:\n\n";

      for (const line of lines) {
        const parts = line.split(/\s+/);
        const worktreePath = parts[0];
        const commit = parts[1];
        const branch = parts[2]?.replace(/[\[\]]/g, "") || "detached";
        
        const isMain = worktreePath === context.worktree;
        const marker = isMain ? " (main)" : "";
        
        output += `• ${branch}${marker}\n`;
        output += `  Path: ${worktreePath}\n`;
        output += `  Commit: ${commit}\n\n`;
      }

      return output.trim();
    } catch (error: any) {
      return `✗ Error listing worktrees: ${error.message || error}`;
    }
  },
});

export const remove = tool({
  description:
    "Remove a git worktree (after merging). Optionally deletes the branch.",
  args: {
    name: tool.schema.string().describe("Worktree name to remove"),
    deleteBranch: tool.schema
      .boolean()
      .optional()
      .describe("Also delete the associated branch (default: false)"),
  },
  async execute(args, context) {
    const { name, deleteBranch = false } = args;
    const worktreePath = path.join(context.worktree, WORKTREE_ROOT, name);
    const absoluteWorktreePath = path.resolve(worktreePath);

    // Check if worktree exists
    if (!fs.existsSync(absoluteWorktreePath)) {
      return `✗ Error: Worktree not found at ${absoluteWorktreePath}

Use worktree_list to see existing worktrees.`;
    }

    // Get branch name before removing
    let branchName = "";
    try {
      branchName = await Bun.$`git -C ${absoluteWorktreePath} branch --show-current`.text();
      branchName = branchName.trim();
    } catch {
      // Ignore error, branch detection is optional
    }

    // Remove the worktree
    try {
      await Bun.$`git worktree remove ${absoluteWorktreePath}`.cwd(context.worktree);
    } catch (error: any) {
      // Try force remove if there are changes
      try {
        await Bun.$`git worktree remove --force ${absoluteWorktreePath}`.cwd(context.worktree);
      } catch (error2: any) {
        return `✗ Error removing worktree: ${error2.message || error2}

The worktree may have uncommitted changes. Commit or stash them first.`;
      }
    }

    let output = `✓ Removed worktree at ${absoluteWorktreePath}`;

    // Delete branch if requested
    if (deleteBranch && branchName) {
      try {
        await Bun.$`git branch -d ${branchName}`.cwd(context.worktree);
        output += `\n✓ Deleted branch ${branchName}`;
      } catch (error: any) {
        output += `\n⚠ Could not delete branch ${branchName}: ${error.message || error}`;
        output += "\n  (Branch may not be fully merged. Use git branch -D to force delete.)";
      }
    }

    return output;
  },
});

export const open = tool({
  description:
    "Get the command to open a new terminal window in a worktree directory",
  args: {
    name: tool.schema.string().describe("Worktree name"),
  },
  async execute(args, context) {
    const { name } = args;
    const worktreePath = path.join(context.worktree, WORKTREE_ROOT, name);
    const absoluteWorktreePath = path.resolve(worktreePath);

    // Check if worktree exists
    if (!fs.existsSync(absoluteWorktreePath)) {
      return `✗ Error: Worktree not found at ${absoluteWorktreePath}

Use worktree_list to see existing worktrees.`;
    }

    // Detect OS and provide appropriate command
    const platform = process.platform;
    let command = "";
    let instructions = "";

    if (platform === "darwin") {
      // macOS
      command = `open -a Terminal "${absoluteWorktreePath}"`;
      instructions = `Or with iTerm2: open -a iTerm "${absoluteWorktreePath}"`;
    } else if (platform === "linux") {
      // Linux - try common terminals
      command = `gnome-terminal --working-directory="${absoluteWorktreePath}" || xterm -e "cd '${absoluteWorktreePath}' && $SHELL" || konsole --workdir "${absoluteWorktreePath}"`;
      instructions = "Command tries gnome-terminal, xterm, then konsole.";
    } else if (platform === "win32") {
      // Windows
      command = `start cmd /k "cd /d ${absoluteWorktreePath}"`;
      instructions = `Or with PowerShell: Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '${absoluteWorktreePath}'"`;
    } else {
      command = `cd "${absoluteWorktreePath}"`;
      instructions = "Unknown platform. Use the cd command above.";
    }

    return `To open a new terminal in the worktree:

${command}

${instructions}

Worktree path: ${absoluteWorktreePath}`;
  },
});
