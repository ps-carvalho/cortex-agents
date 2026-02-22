import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";
import { propagatePlan } from "../utils/propagate.js";

const WORKTREE_ROOT = ".worktrees";

// Extract client and shell types from the plugin input via inference
type Client = PluginInput["client"];
type Shell = PluginInput["$"];

export const create = tool({
  description:
    "Create a new git worktree for isolated development. Worktrees are created in .worktrees/ at the project root.",
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

// ─── Terminal Detection ──────────────────────────────────────────────────────

/**
 * Detect the user's terminal emulator on macOS.
 * Returns "iterm2", "terminal", or "unknown".
 */
function detectMacTerminal(): "iterm2" | "terminal" | "unknown" {
  // iTerm2 sets ITERM_SESSION_ID and TERM_PROGRAM
  if (process.env.ITERM_SESSION_ID || process.env.TERM_PROGRAM === "iTerm.app") {
    return "iterm2";
  }
  if (process.env.TERM_PROGRAM === "Apple_Terminal") {
    return "terminal";
  }
  // Check __CFBundleIdentifier for the running app
  const bundleId = process.env.__CFBundleIdentifier;
  if (bundleId?.includes("iterm2") || bundleId?.includes("iTerm")) {
    return "iterm2";
  }
  if (bundleId?.includes("Terminal") || bundleId?.includes("apple.Terminal")) {
    return "terminal";
  }
  return "unknown";
}

/**
 * Detect the user's terminal emulator on Linux.
 * Returns the terminal name or "unknown".
 */
function detectLinuxTerminal(): string {
  const termProgram = process.env.TERM_PROGRAM;
  if (termProgram) return termProgram.toLowerCase();

  // Check common environment hints
  if (process.env.KITTY_WINDOW_ID) return "kitty";
  if (process.env.ALACRITTY_SOCKET) return "alacritty";
  if (process.env.WEZTERM_PANE) return "wezterm";
  if (process.env.GNOME_TERMINAL_SERVICE) return "gnome-terminal";
  if (process.env.KONSOLE_VERSION) return "konsole";

  return "unknown";
}

/**
 * Find the opencode binary path, checking common locations.
 */
async function findOpencodeBinary(): Promise<string | null> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";

  // Check well-known path first
  const wellKnown = path.join(homeDir, ".opencode", "bin", "opencode");
  if (fs.existsSync(wellKnown)) return wellKnown;

  // Try which/where
  try {
    const result = await Bun.$`which opencode`.quiet().text();
    const bin = result.trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {
    // Not in PATH
  }

  return null;
}

/**
 * Build the prompt string for the new OpenCode session.
 */
function buildLaunchPrompt(planFilename?: string, customPrompt?: string): string {
  if (customPrompt) return customPrompt;

  if (planFilename) {
    return `Load the plan at .cortex/plans/${planFilename} and implement all tasks listed in it. Follow the plan's technical approach and phases.`;
  }

  return "Check for plans in .cortex/plans/ and begin implementation. If no plan exists, analyze the codebase and suggest next steps.";
}

// ─── Mode A: New Terminal Tab ────────────────────────────────────────────────

async function launchTerminalTab(
  worktreePath: string,
  opencodeBin: string,
  agent: string,
  prompt: string,
): Promise<string> {
  const platform = process.platform;

  // Build the command to run inside the new terminal
  const innerCmd = `cd "${worktreePath}" && "${opencodeBin}" --agent ${agent} --prompt "${prompt.replace(/"/g, '\\"')}"`;

  if (platform === "darwin") {
    const terminal = detectMacTerminal();

    if (terminal === "iterm2") {
      const script = `tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session of current tab
      write text "cd \\"${worktreePath}\\" && \\"${opencodeBin}\\" --agent ${agent}"
    end tell
  end tell
end tell`;
      try {
        await Bun.$`osascript -e ${script}`;
        return `✓ Opened new iTerm2 tab in worktree`;
      } catch {
        // Fall back to generic open
      }
    }

    if (terminal === "terminal" || terminal === "unknown") {
      // Terminal.app: `do script` opens in a new window by default
      // Using "do script in window 1" would reuse, so we use a plain `do script`
      const script = `tell application "Terminal"
  activate
  do script "cd \\"${worktreePath}\\" && \\"${opencodeBin}\\" --agent ${agent}"
end tell`;
      try {
        await Bun.$`osascript -e ${script}`;
        return `✓ Opened new Terminal.app window in worktree`;
      } catch (err: any) {
        // Last resort: use open -a
        try {
          await Bun.$`open -a Terminal "${worktreePath}"`;
          return `✓ Opened Terminal.app in worktree directory (run opencode manually)`;
        } catch {
          return `✗ Could not open terminal. Manual command:\n  ${innerCmd}`;
        }
      }
    }
  }

  if (platform === "linux") {
    const terminal = detectLinuxTerminal();

    const launchers: Record<string, string[]> = {
      "kitty": ["kitty", "--directory", worktreePath, "--", "bash", "-c", innerCmd],
      "alacritty": ["alacritty", "--working-directory", worktreePath, "-e", "bash", "-c", innerCmd],
      "wezterm": ["wezterm", "start", "--cwd", worktreePath, "--", "bash", "-c", innerCmd],
      "gnome-terminal": ["gnome-terminal", "--working-directory", worktreePath, "--", "bash", "-c", innerCmd],
      "konsole": ["konsole", "--workdir", worktreePath, "-e", "bash", "-c", innerCmd],
    };

    const args = launchers[terminal];
    if (args) {
      try {
        Bun.spawn(args, { cwd: worktreePath, stdout: "ignore", stderr: "ignore" });
        return `✓ Opened ${terminal} in worktree`;
      } catch {
        // Fall through to generic attempt
      }
    }

    // Generic fallback: try common terminals in order
    for (const [name, cmdArgs] of Object.entries(launchers)) {
      try {
        Bun.spawn(cmdArgs, { cwd: worktreePath, stdout: "ignore", stderr: "ignore" });
        return `✓ Opened ${name} in worktree`;
      } catch {
        continue;
      }
    }

    return `✗ Could not detect terminal emulator. Manual command:\n  ${innerCmd}`;
  }

  if (platform === "win32") {
    try {
      await Bun.$`start cmd /k "cd /d ${worktreePath} && ${opencodeBin} --agent ${agent}"`;
      return `✓ Opened new cmd window in worktree`;
    } catch {
      return `✗ Could not open terminal. Manual command:\n  ${innerCmd}`;
    }
  }

  return `✗ Unsupported platform: ${platform}. Manual command:\n  ${innerCmd}`;
}

// ─── Mode B: In-App PTY ─────────────────────────────────────────────────────

async function launchPty(
  client: Client,
  worktreePath: string,
  branchName: string,
  opencodeBin: string,
  agent: string,
  prompt: string,
): Promise<string> {
  try {
    await client.pty.create({
      body: {
        command: opencodeBin,
        args: ["--agent", agent, "--prompt", prompt],
        cwd: worktreePath,
        title: `Worktree: ${branchName}`,
      },
    });

    return `✓ Created in-app PTY session for worktree

Branch: ${branchName}
Title: "Worktree: ${branchName}"

The PTY is running OpenCode with agent '${agent}' in the worktree.
Switch to it using OpenCode's terminal panel.`;
  } catch (error: any) {
    return `✗ Failed to create PTY session: ${error.message || error}

Falling back to manual command:
  cd "${worktreePath}" && "${opencodeBin}" --agent ${agent}`;
  }
}

// ─── Mode C: Background Session ─────────────────────────────────────────────

async function launchBackground(
  client: Client,
  worktreePath: string,
  branchName: string,
  opencodeBin: string,
  agent: string,
  prompt: string,
): Promise<string> {
  // Spawn opencode run as a detached background process
  const proc = Bun.spawn(
    [opencodeBin, "run", "--agent", agent, prompt],
    {
      cwd: worktreePath,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        // Ensure the background instance knows its directory
        HOME: process.env.HOME || "",
        PATH: process.env.PATH || "",
      },
    },
  );

  // Save PID for tracking
  const cortexDir = path.join(worktreePath, ".cortex");
  if (!fs.existsSync(cortexDir)) {
    fs.mkdirSync(cortexDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(cortexDir, ".background-pid"),
    JSON.stringify({
      pid: proc.pid,
      branch: branchName,
      agent,
      startedAt: new Date().toISOString(),
    }),
  );

  // Show initial toast
  try {
    await client.tui.showToast({
      body: {
        title: `Background: ${branchName}`,
        message: `Started background implementation with agent '${agent}'`,
        variant: "info",
        duration: 5000,
      },
    });
  } catch {
    // Toast failure is non-fatal
  }

  // Monitor completion in background (fire-and-forget)
  monitorBackgroundProcess(proc, client, branchName, worktreePath);

  return `✓ Launched background implementation

Branch: ${branchName}
PID: ${proc.pid}
Agent: ${agent}
Working in: ${worktreePath}

The AI is implementing in the background. You'll get a toast notification
when it completes or fails.

PID tracking file: ${path.join(cortexDir, ".background-pid")}

To check worktree status later:
  git -C "${worktreePath}" status
  git -C "${worktreePath}" log --oneline -5`;
}

/**
 * Monitor a background process and notify via toast on completion.
 * This runs asynchronously — does not block the tool response.
 */
async function monitorBackgroundProcess(
  proc: ReturnType<typeof Bun.spawn>,
  client: Client,
  branchName: string,
  worktreePath: string,
): Promise<void> {
  try {
    // Wait for the process to exit (non-blocking from the tool's perspective)
    const exitCode = await proc.exited;

    // Clean up PID file
    const pidFile = path.join(worktreePath, ".cortex", ".background-pid");
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }

    if (exitCode === 0) {
      await client.tui.showToast({
        body: {
          title: `Background: ${branchName}`,
          message: "Implementation complete! Check the worktree for changes.",
          variant: "success",
          duration: 10000,
        },
      });
    } else {
      await client.tui.showToast({
        body: {
          title: `Background: ${branchName}`,
          message: `Process exited with code ${exitCode}. Check the worktree.`,
          variant: "warning",
          duration: 10000,
        },
      });
    }
  } catch (error: any) {
    try {
      await client.tui.showToast({
        body: {
          title: `Background: ${branchName}`,
          message: `Error: ${error.message || "Process monitoring failed"}`,
          variant: "error",
          duration: 10000,
        },
      });
    } catch {
      // If toast fails too, nothing we can do
    }
  }
}

// ─── worktree_launch Factory ─────────────────────────────────────────────────

/**
 * Factory function that creates the worktree_launch tool with access
 * to the OpenCode client (for PTY and toast) and shell.
 *
 * This uses a closure to capture `client` and `shell` since ToolContext
 * does not provide access to the OpenCode client API.
 */
export function createLaunch(client: Client, shell: Shell) {
  return tool({
    description:
      "Launch an OpenCode session in an existing worktree. Supports three modes: " +
      "'terminal' opens a new terminal tab, 'pty' creates an in-app PTY session, " +
      "'background' runs implementation headlessly with progress notifications.",
    args: {
      name: tool.schema
        .string()
        .describe("Worktree name (must already exist — use worktree_create first)"),
      mode: tool.schema
        .enum(["terminal", "pty", "background"])
        .describe(
          "Launch mode: 'terminal' = new terminal tab, 'pty' = in-app PTY session, " +
          "'background' = headless execution with toast notifications",
        ),
      plan: tool.schema
        .string()
        .optional()
        .describe("Plan filename to propagate into the worktree (e.g., '2026-02-22-feature-auth.md')"),
      agent: tool.schema
        .string()
        .optional()
        .describe("Agent to use in the new session (default: 'build')"),
      prompt: tool.schema
        .string()
        .optional()
        .describe("Custom prompt for the new session (auto-generated from plan if omitted)"),
    },
    async execute(args, context) {
      const {
        name,
        mode,
        plan: planFilename,
        agent = "build",
        prompt: customPrompt,
      } = args;

      const worktreePath = path.join(context.worktree, WORKTREE_ROOT, name);
      const absoluteWorktreePath = path.resolve(worktreePath);

      // ── Validate worktree exists ───────────────────────────────
      if (!fs.existsSync(absoluteWorktreePath)) {
        return `✗ Error: Worktree not found at ${absoluteWorktreePath}

Use worktree_create to create it first, then worktree_launch to start working in it.
Use worktree_list to see existing worktrees.`;
      }

      // ── Find opencode binary ───────────────────────────────────
      const opencodeBin = await findOpencodeBinary();
      if (!opencodeBin) {
        return `✗ Error: Could not find the 'opencode' binary.

Checked:
  - ~/.opencode/bin/opencode
  - $PATH (via 'which opencode')

Install OpenCode or ensure it's in your PATH.`;
      }

      // ── Detect branch name ─────────────────────────────────────
      let branchName = name;
      try {
        const branch = await Bun.$`git -C ${absoluteWorktreePath} branch --show-current`.quiet().text();
        if (branch.trim()) branchName = branch.trim();
      } catch {
        // Use worktree name as fallback
      }

      // ── Propagate plan to worktree ─────────────────────────────
      let planInfo = "";
      if (planFilename || fs.existsSync(path.join(context.worktree, ".cortex", "plans"))) {
        const result = propagatePlan({
          sourceWorktree: context.worktree,
          targetWorktree: absoluteWorktreePath,
          planFilename,
        });

        if (result.copied.length > 0) {
          planInfo = `\nPlans propagated: ${result.copied.join(", ")}`;
          if (result.initialized) {
            planInfo += " (.cortex initialized in worktree)";
          }
        }
      }

      // ── Build prompt ───────────────────────────────────────────
      const launchPrompt = buildLaunchPrompt(planFilename, customPrompt);

      // ── Launch based on mode ───────────────────────────────────
      let launchResult: string;

      switch (mode) {
        case "terminal":
          launchResult = await launchTerminalTab(
            absoluteWorktreePath,
            opencodeBin,
            agent,
            launchPrompt,
          );
          break;

        case "pty":
          launchResult = await launchPty(
            client,
            absoluteWorktreePath,
            branchName,
            opencodeBin,
            agent,
            launchPrompt,
          );
          break;

        case "background":
          launchResult = await launchBackground(
            client,
            absoluteWorktreePath,
            branchName,
            opencodeBin,
            agent,
            launchPrompt,
          );
          break;

        default:
          launchResult = `✗ Unknown mode: ${mode}`;
      }

      return `${launchResult}${planInfo}`;
    },
  });
}
