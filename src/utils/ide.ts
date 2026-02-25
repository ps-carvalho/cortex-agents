/**
 * IDE Detection System
 *
 * Detects the current Integrated Development Environment or editor context.
 * This is used to offer appropriate worktree launch options that match
 * the user's current workflow.
 *
 * Detection is based on environment variables set by various IDEs when
 * running terminal sessions within them.
 */

import { shellEscape, which } from "./shell.js";

export type IDEType =
  | "vscode"      // Visual Studio Code
  | "cursor"      // Cursor (AI editor)
  | "windsurf"    // Windsurf (Codeium)
  | "jetbrains"   // JetBrains IDEs (WebStorm, IntelliJ, etc.)
  | "zed"         // Zed editor
  | "terminal"    // Standalone terminal (no IDE)
  | "unknown";    // Could not detect

export interface IDEDetection {
  type: IDEType;
  name: string;           // Human-readable name
  version?: string;       // IDE version if available
  hasIntegratedTerminal: boolean;
  canOpenInTerminal: boolean;
  canOpenInWindow: boolean;
  cliAvailable?: boolean;       // Runtime check: is CLI binary actually in PATH?
  cliBinary?: string;           // The CLI binary name that was checked
  cliInstallHint?: string;      // How to install the CLI if missing
  detectionSource: string; // Which env var or method detected it
}

export interface EnvironmentRecommendation {
  option: string;
  priority: "high" | "medium" | "low";
  reason: string;
  mode?: "ide" | "terminal" | "pty" | "background" | "stay";
}

/**
 * Detect the current IDE/editor environment.
 * Checks environment variables, process hierarchy, and context clues.
 */
export function detectIDE(): IDEDetection {
  const env = process.env;

  // VS Code detection
  // VSCODE_PID is set when running in VS Code's integrated terminal
  // VSCODE_CWD is set in some VS Code contexts
  // TERM_PROGRAM=vscode is set by VS Code's terminal
  if (env.VSCODE_PID || env.VSCODE_CWD || env.TERM_PROGRAM === "vscode") {
    return {
      type: "vscode",
      name: "Visual Studio Code",
      version: env.VSCODE_VERSION,
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: env.VSCODE_PID ? "VSCODE_PID" :
                        env.VSCODE_CWD ? "VSCODE_CWD" : "TERM_PROGRAM",
    };
  }

  // Cursor detection
  // CURSOR_TRACE_ID is set by Cursor AI editor
  // CURSOR_SHELL_VERSION indicates Cursor's shell integration
  if (env.CURSOR_TRACE_ID || env.CURSOR_SHELL_VERSION) {
    return {
      type: "cursor",
      name: "Cursor",
      version: env.CURSOR_SHELL_VERSION,
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: env.CURSOR_TRACE_ID ? "CURSOR_TRACE_ID" : "CURSOR_SHELL_VERSION",
    };
  }

  // Windsurf detection
  // WINDSURF_PARENT_PROCESS indicates Windsurf editor
  // WINDSURF_EDITOR is set by Windsurf's terminal
  if (env.WINDSURF_PARENT_PROCESS || env.WINDSURF_EDITOR) {
    return {
      type: "windsurf",
      name: "Windsurf",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: env.WINDSURF_PARENT_PROCESS ? "WINDSURF_PARENT_PROCESS" : "WINDSURF_EDITOR",
    };
  }

  // JetBrains detection
  // TERMINAL_EMULATOR contains "JetBrains" when in JB IDE terminal
  // JETBRAINS_IDE is set by some JetBrains IDEs
  if (env.TERMINAL_EMULATOR?.includes("JetBrains") || env.JETBRAINS_IDE) {
    return {
      type: "jetbrains",
      name: env.JETBRAINS_IDE_NAME || "JetBrains IDE",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true, // Can open in terminal, but no CLI for new window
      canOpenInWindow: false, // JB IDEs don't have CLI window opening
      detectionSource: env.JETBRAINS_IDE ? "JETBRAINS_IDE" : "TERMINAL_EMULATOR",
    };
  }

  // Zed detection
  // ZED_TERM is set by Zed's integrated terminal
  // TERM_PROGRAM=zed in some Zed configurations
  if (env.ZED_TERM || env.TERM_PROGRAM === "zed") {
    return {
      type: "zed",
      name: "Zed",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: env.ZED_TERM ? "ZED_TERM" : "TERM_PROGRAM",
    };
  }

  // Terminal-only detection (fallback when no IDE detected)
  // This means we're in a standalone terminal emulator
  if (env.TERM_PROGRAM || env.TMUX || env.TERM) {
    return {
      type: "terminal",
      name: env.TERM_PROGRAM || env.TERM || "Terminal",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: env.TERM_PROGRAM ? "TERM_PROGRAM" :
                        env.TMUX ? "TMUX" : "TERM",
    };
  }

  // Unknown environment
  return {
    type: "unknown",
    name: "Unknown",
    hasIntegratedTerminal: false,
    canOpenInTerminal: false,
    canOpenInWindow: true,
    detectionSource: "none",
  };
}

/**
 * Get the command to open a worktree in the IDE's integrated terminal.
 * Returns null if the IDE doesn't support CLI-based opening.
 *
 * Note: This function is currently unused but kept for future use.
 * All inputs are escaped to prevent command injection.
 */
export function getIDEOpenCommand(ide: IDEDetection, worktreePath: string): string | null {
  // Escape the path to prevent command injection
  const safePath = shellEscape(worktreePath);

  switch (ide.type) {
    case "vscode":
      // VS Code: use `code` CLI to open folder in new window
      return `code --new-window "${safePath}"`;

    case "cursor":
      // Cursor: use `cursor` CLI
      return `cursor --new-window "${safePath}"`;

    case "windsurf":
      // Windsurf: use `windsurf` CLI
      return `windsurf "${safePath}"`;

    case "zed":
      // Zed: use `zed` CLI
      return `zed "${safePath}"`;

    case "jetbrains":
      // JetBrains: requires manual opening or platform-specific CLI
      // Common CLIs: idea, webstorm, pycharm, etc.
      return null;

    default:
      return null;
  }
}

/**
 * Get the name of the CLI binary for the detected IDE.
 * Returns null if no CLI is available or known.
 */
export function getIDECliBinary(ide: IDEDetection): string | null {
  switch (ide.type) {
    case "vscode":
      return "code";
    case "cursor":
      return "cursor";
    case "windsurf":
      return "windsurf";
    case "zed":
      return "zed";
    default:
      return null;
  }
}

/**
 * Get a human-readable hint for installing an IDE's CLI binary.
 * Each IDE has a different installation method.
 */
export function getInstallHint(type: IDEType, binary: string): string {
  switch (type) {
    case "vscode":
      return "Cmd+Shift+P → 'Shell Command: Install code command in PATH'";
    case "cursor":
      return "Cmd+Shift+P → 'Shell Command: Install cursor command in PATH'";
    case "windsurf":
      return "Ensure Windsurf is installed and 'windsurf' is in PATH";
    case "zed":
      return "Ensure Zed is installed and 'zed' is in PATH";
    default:
      return `Ensure '${binary}' is in PATH`;
  }
}

/**
 * Async version of detectIDE() that also checks whether the IDE's CLI binary
 * is actually available in PATH. Use this in tools where you need to verify
 * runtime availability before offering IDE launch options.
 *
 * The sync detectIDE() is preserved for non-async contexts.
 */
export async function detectIDEWithCLICheck(): Promise<IDEDetection> {
  const ide = detectIDE();
  const cliBinary = getIDECliBinary(ide);

  if (cliBinary) {
    const available = await which(cliBinary);
    ide.cliAvailable = !!available;
    ide.cliBinary = cliBinary;
    if (!available) {
      ide.cliInstallHint = getInstallHint(ide.type, cliBinary);
    }
  } else {
    ide.cliAvailable = false;
  }

  return ide;
}

/**
 * Check if we're already inside an IDE terminal.
 * This helps determine if we should offer "stay here" as primary option.
 */
export function isInIDETerminal(): boolean {
  const ide = detectIDE();
  return ide.hasIntegratedTerminal && !!process.env.TERM;
}

/**
 * Generate contextual recommendations based on detected environment.
 * Used by agents to offer appropriate launch options to users.
 */
export function generateEnvironmentRecommendations(ide: IDEDetection): EnvironmentRecommendation[] {
  const recommendations: EnvironmentRecommendation[] = [];

  if (ide.hasIntegratedTerminal && ide.canOpenInTerminal && ide.cliAvailable !== false) {
    // Only offer IDE option when CLI is confirmed available or hasn't been checked yet
    recommendations.push({
      option: `Open in ${ide.name} (Recommended)`,
      priority: "high",
      reason: `${ide.name} integrated terminal maintains context and is familiar`,
      mode: "ide",
    });
  } else if (ide.hasIntegratedTerminal && ide.cliAvailable === false) {
    // IDE detected but CLI missing — note it but don't recommend
    recommendations.push({
      option: `Open in ${ide.name} (CLI not installed)`,
      priority: "low",
      reason: `${ide.cliBinary || "CLI"} not in PATH. ${ide.cliInstallHint || "Install the CLI to enable this option."}`,
      mode: "ide",
    });
  }

  recommendations.push({
    option: "Open in new terminal tab",
    priority: ide.cliAvailable === false ? "high" : "medium",
    reason: "Open in your current terminal emulator as a new tab",
    mode: "terminal",
  });

  recommendations.push({
    option: "Open in-app PTY",
    priority: "medium",
    reason: "Embedded terminal within this OpenCode session",
    mode: "pty",
  });

  recommendations.push({
    option: "Run in background",
    priority: "low",
    reason: "AI implements headlessly while you keep working here",
    mode: "background",
  });

  recommendations.push({
    option: "Stay in current session",
    priority: "low",
    reason: "Continue working in this terminal session",
    mode: "stay",
  });

  return recommendations;
}

/**
 * Format environment detection as a human-readable report.
 * Used by the detect_environment tool.
 */
export function formatEnvironmentReport(ide: IDEDetection, terminalName: string): string {
  const lines: string[] = [
    `## Environment Detection`,
    ``,
    `**IDE/Editor:** ${ide.name}`,
    `**Detection Method:** ${ide.detectionSource}`,
    `**Terminal:** ${terminalName}`,
    `**Platform:** ${process.platform}`,
    ``,
  ];

  if (ide.version) {
    lines.push(`**Version:** ${ide.version}`, ``);
  }

  lines.push(`### Capabilities`, ``);

  if (ide.hasIntegratedTerminal) {
    lines.push(`- ✓ Has integrated terminal`);
  } else {
    lines.push(`- ✗ No integrated terminal`);
  }

  if (ide.canOpenInWindow) {
    if (ide.cliAvailable === false) {
      lines.push(`- ⚠ Can open new window via CLI — but \`${ide.cliBinary || "cli"}\` NOT found in PATH`);
      if (ide.cliInstallHint) {
        lines.push(`  Fix: ${ide.cliInstallHint}`);
      }
    } else if (ide.cliAvailable === true) {
      lines.push(`- ✓ Can open new window via CLI (\`${ide.cliBinary}\` available)`);
    } else {
      lines.push(`- ✓ Can open new window via CLI`);
    }
  } else {
    lines.push(`- ✗ Cannot open new window via CLI`);
  }

  lines.push(``, `### Recommended Launch Options`, ``);

  const recommendations = generateEnvironmentRecommendations(ide);
  for (const rec of recommendations) {
    const priorityBadge = rec.priority === "high" ? " (Recommended)" :
                          rec.priority === "medium" ? "" : "";
    lines.push(`- **${rec.option}${priorityBadge}** — ${rec.reason}`);
  }

  return lines.join("\n");
}
