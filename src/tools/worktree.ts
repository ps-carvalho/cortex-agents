import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";
import { propagatePlan } from "../utils/propagate.js";
import { exec, git, which, shellEscape, kill, spawn as shellSpawn } from "../utils/shell.js";
import {
  detectDriver,
  closeSession,
  writeSession,
  readSession,
  type TerminalSession,
  type TabOpenOptions,
} from "../utils/terminal.js";

const WORKTREE_ROOT = ".worktrees";

// Extract client and shell types from the plugin input via inference
type Client = PluginInput["client"];
type Shell = PluginInput["$"];

/**
 * Factory function that creates the worktree_create tool with access
 * to the OpenCode client for toast notifications.
 */
export function createCreate(client: Client) {
  return tool({
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
        await git(context.worktree, "rev-parse", "--git-dir");
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
        await git(context.worktree, "worktree", "add", "-b", branchName, absoluteWorktreePath);
      } catch {
        // Branch might already exist, try without -b
        try {
          await git(context.worktree, "worktree", "add", absoluteWorktreePath, branchName);
        } catch (error2: any) {
          try {
            await client.tui.showToast({
              body: {
                title: `Worktree: ${name}`,
                message: `Failed to create: ${error2.message || error2}`,
                variant: "error",
                duration: 8000,
              },
            });
          } catch {
            // Toast failure is non-fatal
          }
          return `✗ Error creating worktree: ${error2.message || error2}`;
        }
      }

      // Notify via toast
      try {
        await client.tui.showToast({
          body: {
            title: `Worktree: ${name}`,
            message: `Created on branch ${branchName}`,
            variant: "success",
            duration: 4000,
          },
        });
      } catch {
        // Toast failure is non-fatal
      }

      return `✓ Created worktree successfully

Branch: ${branchName}
Path: ${absoluteWorktreePath}

To work in this worktree:
  cd ${absoluteWorktreePath}

Or use worktree_open to get a command to open a new terminal there.`;
    },
  });
}

export const list = tool({
  description: "List all git worktrees for this project",
  args: {},
  async execute(args, context) {
    try {
      const { stdout } = await git(context.worktree, "worktree", "list");

      if (!stdout.trim()) {
        return "No worktrees found.";
      }

      const lines = stdout.trim().split("\n");
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

/**
 * Factory function that creates the worktree_remove tool with access
 * to the OpenCode client for toast notifications and PTY cleanup.
 */
export function createRemove(client: Client) {
  return tool({
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
        const { stdout } = await git(absoluteWorktreePath, "branch", "--show-current");
        branchName = stdout.trim();
      } catch {
        // Ignore error, branch detection is optional
      }

      // ── Close terminal session BEFORE git removes the directory ──
      let closedSession = false;
      const session = readSession(absoluteWorktreePath);
      if (session) {
        if (session.mode === "pty" && session.ptyId) {
          // Close PTY session via OpenCode SDK
          try {
            await client.pty.remove({ path: { id: session.ptyId } });
            closedSession = true;
          } catch {
            // PTY may already be closed
          }
        } else if (session.mode === "terminal") {
          // Close terminal tab via driver
          closedSession = await closeSession(session);
        } else if (session.mode === "background" && session.pid) {
          closedSession = kill(session.pid);
        }

        // Fallback: kill PID if driver close failed
        if (!closedSession && session.pid) {
          kill(session.pid);
        }
      }

      // Also clean up legacy .background-pid file
      const bgPidFile = path.join(absoluteWorktreePath, ".cortex", ".background-pid");
      if (fs.existsSync(bgPidFile)) {
        try {
          const bgData = JSON.parse(fs.readFileSync(bgPidFile, "utf-8"));
          if (bgData.pid) kill(bgData.pid);
        } catch {
          // Ignore parse errors
        }
      }

      // ── Remove the worktree ─────────────────────────────────────
      try {
        await git(context.worktree, "worktree", "remove", absoluteWorktreePath);
      } catch {
        // Try force remove if there are changes
        try {
          await git(context.worktree, "worktree", "remove", "--force", absoluteWorktreePath);
        } catch (error2: any) {
          try {
            await client.tui.showToast({
              body: {
                title: `Worktree: ${name}`,
                message: `Failed to remove: ${error2.message || error2}`,
                variant: "error",
                duration: 8000,
              },
            });
          } catch {
            // Toast failure is non-fatal
          }
          return `✗ Error removing worktree: ${error2.message || error2}

The worktree may have uncommitted changes. Commit or stash them first.`;
        }
      }

      let output = `✓ Removed worktree at ${absoluteWorktreePath}`;
      if (closedSession && session) {
        output += `\n✓ Closed ${session.mode === "pty" ? "PTY session" : `${session.terminal} tab`}`;
      }

      // Delete branch if requested
      if (deleteBranch && branchName) {
        try {
          await git(context.worktree, "branch", "-d", branchName);
          output += `\n✓ Deleted branch ${branchName}`;
        } catch (error: any) {
          output += `\n⚠ Could not delete branch ${branchName}: ${error.message || error}`;
          output += "\n  (Branch may not be fully merged. Use git branch -D to force delete.)";
        }
      }

      // Notify via toast
      try {
        const closedInfo = closedSession ? " + closed tab" : "";
        await client.tui.showToast({
          body: {
            title: `Worktree: ${name}`,
            message: branchName
              ? `Removed worktree${closedInfo} (branch ${branchName} ${deleteBranch ? "deleted" : "kept"})`
              : `Removed worktree${closedInfo}`,
            variant: "success",
            duration: 4000,
          },
        });
      } catch {
        // Toast failure is non-fatal
      }

      return output;
    },
  });
}

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

// ─── Terminal detection and tab management now in src/utils/terminal.ts ──────

/**
 * Find the opencode binary path, checking common locations.
 */
async function findOpencodeBinary(): Promise<string | null> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";

  // Check well-known path first
  const wellKnown = path.join(homeDir, ".opencode", "bin", "opencode");
  if (fs.existsSync(wellKnown)) return wellKnown;

  // Try which
  const bin = await which("opencode");
  if (bin && fs.existsSync(bin)) return bin;

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

// ─── Mode A: New Terminal Tab (via driver system) ────────────────────────────

async function launchTerminalTab(
  client: Client,
  worktreePath: string,
  branchName: string,
  opencodeBin: string,
  agent: string,
  prompt: string,
): Promise<string> {
  /** Fire a toast notification for terminal launch results. */
  const notify = async (
    message: string,
    variant: "info" | "success" | "warning" | "error" = "success",
  ) => {
    try {
      await client.tui.showToast({
        body: {
          title: `Terminal: ${branchName}`,
          message,
          variant,
          duration: variant === "error" ? 8000 : 4000,
        },
      });
    } catch {
      // Toast failure is non-fatal
    }
  };

  const driver = detectDriver();
  const opts: TabOpenOptions = {
    worktreePath,
    opencodeBin,
    agent,
    prompt,
    branchName,
  };

  try {
    const result = await driver.openTab(opts);

    // Persist session for later cleanup (e.g., worktree_remove)
    const session: TerminalSession = {
      terminal: driver.name,
      platform: process.platform,
      mode: "terminal",
      branch: branchName,
      agent,
      worktreePath,
      startedAt: new Date().toISOString(),
      ...result,
    };
    writeSession(worktreePath, session);

    await notify(`Opened ${driver.name} tab with agent '${agent}'`);
    return `✓ Opened ${driver.name} tab in worktree\n\nBranch: ${branchName}\nTerminal: ${driver.name}`;
  } catch (error: any) {
    await notify(`Could not open terminal: ${error.message || error}`, "error");
    const innerCmd = `cd "${worktreePath}" && "${opencodeBin}" --agent ${agent}`;
    return `✗ Could not open terminal (${driver.name}). Manual command:\n  ${innerCmd}`;
  }
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
    const response = await client.pty.create({
      body: {
        command: opencodeBin,
        args: ["--agent", agent, "--prompt", prompt],
        cwd: worktreePath,
        title: `Worktree: ${branchName}`,
      },
    });

    // Capture PTY ID and PID from response for later cleanup
    const ptyId = response.data?.id;
    const ptyPid = response.data?.pid;

    // Persist session for cleanup on worktree_remove
    writeSession(worktreePath, {
      terminal: "pty",
      platform: process.platform,
      mode: "pty",
      ptyId: ptyId ?? undefined,
      pid: ptyPid ?? undefined,
      branch: branchName,
      agent,
      worktreePath,
      startedAt: new Date().toISOString(),
    });

    // Show toast for PTY launch
    try {
      await client.tui.showToast({
        body: {
          title: `PTY: ${branchName}`,
          message: `Created in-app session with agent '${agent}'`,
          variant: "success",
          duration: 4000,
        },
      });
    } catch {
      // Toast failure is non-fatal
    }

    return `✓ Created in-app PTY session for worktree

Branch: ${branchName}
Title: "Worktree: ${branchName}"

The PTY is running OpenCode with agent '${agent}' in the worktree.
Switch to it using OpenCode's terminal panel.`;
  } catch (error: any) {
    try {
      await client.tui.showToast({
        body: {
          title: `PTY: ${branchName}`,
          message: `Failed to create session: ${error.message || error}`,
          variant: "error",
          duration: 8000,
        },
      });
    } catch {
      // Toast failure is non-fatal
    }

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
  const proc = shellSpawn(
    opencodeBin,
    ["run", "--agent", agent, prompt],
    {
      cwd: worktreePath,
      stdio: "pipe",
      env: {
        ...process.env,
        HOME: process.env.HOME || "",
        PATH: process.env.PATH || "",
      },
    },
  );

  // Save PID for tracking (legacy format)
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

  // Also write unified terminal session for cleanup on worktree_remove
  writeSession(worktreePath, {
    terminal: "background",
    platform: process.platform,
    mode: "background",
    pid: proc.pid ?? undefined,
    branch: branchName,
    agent,
    worktreePath,
    startedAt: new Date().toISOString(),
  });

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
  proc: ReturnType<typeof shellSpawn>,
  client: Client,
  branchName: string,
  worktreePath: string,
): Promise<void> {
  try {
    // Wait for the process to exit
    const exitCode = await new Promise<number>((resolve) => {
      proc.on("exit", (code) => resolve(code ?? 1));
      proc.on("error", () => resolve(1));
    });

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
        const { stdout } = await git(absoluteWorktreePath, "branch", "--show-current");
        if (stdout.trim()) branchName = stdout.trim();
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
            client,
            absoluteWorktreePath,
            branchName,
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
