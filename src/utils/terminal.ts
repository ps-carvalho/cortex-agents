/**
 * Terminal Driver System — Strategy pattern for cross-platform terminal tab management.
 *
 * Each supported terminal emulator implements the TerminalDriver interface for:
 *   - detect()  — check if this is the active terminal
 *   - openTab() — open a new tab and return identifiers
 *   - closeTab() — close a tab by its identifiers (idempotent, never throws)
 *
 * Session data is persisted to `.cortex/.terminal-session` inside each worktree
 * so tabs can be closed when the worktree is removed.
 */

import * as fs from "fs";
import * as path from "path";
import { exec, shellEscape, spawn, which } from "./shell.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Persisted session data for an opened terminal tab. */
export interface TerminalSession {
  /** Driver name (e.g., "iterm2", "kitty", "tmux", "pty") */
  terminal: string;
  platform: NodeJS.Platform;

  // Terminal-specific identifiers for tab closing
  sessionId?: string; // iTerm2 session ID
  windowId?: string; // Terminal.app window ID
  tabId?: string; // kitty tab ID
  paneId?: string; // wezterm pane ID, tmux pane ID
  dbusPath?: string; // konsole D-Bus session path
  pid?: number; // Shell PID (universal fallback)
  ptyId?: string; // OpenCode PTY session ID

  // Metadata
  mode: "terminal" | "pty" | "background";
  branch: string;
  agent: string;
  worktreePath: string;
  startedAt: string; // ISO timestamp
}

/** Options passed to a driver's openTab() method. */
export interface TabOpenOptions {
  worktreePath: string;
  opencodeBin: string;
  agent: string;
  prompt: string;
  branchName: string;
}

/** Common interface for all terminal drivers. */
export interface TerminalDriver {
  readonly name: string;
  detect(): boolean;
  openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>>;
  closeTab(session: TerminalSession): Promise<boolean>;
}

// ─── Session I/O ─────────────────────────────────────────────────────────────

const SESSION_FILE = ".terminal-session";

/** Persist terminal session data to the worktree's .cortex directory. */
export function writeSession(
  worktreePath: string,
  session: TerminalSession,
): void {
  const cortexDir = path.join(worktreePath, ".cortex");
  if (!fs.existsSync(cortexDir)) {
    fs.mkdirSync(cortexDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(cortexDir, SESSION_FILE),
    JSON.stringify(session, null, 2),
  );
}

/** Read terminal session data from the worktree's .cortex directory. */
export function readSession(
  worktreePath: string,
): TerminalSession | null {
  const sessionPath = path.join(worktreePath, ".cortex", SESSION_FILE);
  if (!fs.existsSync(sessionPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
  } catch {
    return null;
  }
}

// ─── Helper: build the shell command for the new tab ─────────────────────────

function buildTabCommand(opts: TabOpenOptions): string {
  return `cd "${opts.worktreePath}" && "${opts.opencodeBin}" --agent ${opts.agent}`;
}

// ─── Helper: safe process kill ───────────────────────────────────────────────

function killPid(pid: number): boolean {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false; // Process already dead or permission denied
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Driver Implementations
// ═════════════════════════════════════════════════════════════════════════════

// ─── tmux (multiplexer — highest priority) ───────────────────────────────────

class TmuxDriver implements TerminalDriver {
  readonly name = "tmux";

  detect(): boolean {
    return !!process.env.TMUX;
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const cmd = buildTabCommand(opts);
    try {
      // -P prints info about the new window, -F formats it
      const result = await exec("tmux", [
        "new-window",
        "-P",
        "-F",
        "#{pane_id}",
        "-c",
        opts.worktreePath,
        cmd,
      ]);
      const paneId = result.stdout.trim();
      return { paneId: paneId || undefined };
    } catch {
      // Fallback: try without -P (older tmux)
      try {
        await exec("tmux", ["new-window", "-c", opts.worktreePath, cmd]);
        return {};
      } catch {
        throw new Error("Failed to open tmux window");
      }
    }
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    if (session.paneId) {
      try {
        await exec("tmux", ["kill-pane", "-t", session.paneId], { nothrow: true });
        return true;
      } catch {
        // Pane already closed
      }
    }
    // Fallback: kill PID
    if (session.pid) return killPid(session.pid);
    return false;
  }
}

// ─── iTerm2 (macOS) ──────────────────────────────────────────────────────────

class ITerm2Driver implements TerminalDriver {
  readonly name = "iterm2";

  detect(): boolean {
    if (process.platform !== "darwin") return false;
    if (process.env.ITERM_SESSION_ID) return true;
    if (process.env.TERM_PROGRAM === "iTerm.app") return true;
    const bundleId = process.env.__CFBundleIdentifier;
    if (bundleId?.includes("iterm2") || bundleId?.includes("iTerm")) return true;
    return false;
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const safePath = shellEscape(opts.worktreePath);
    const safeBin = shellEscape(opts.opencodeBin);
    const safeAgent = shellEscape(opts.agent);

    // Create tab, write command, capture session ID
    const script = `tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session of current tab
      write text "cd \\"${safePath}\\" && \\"${safeBin}\\" --agent ${safeAgent}"
      return id
    end tell
  end tell
end tell`;

    try {
      const result = await exec("osascript", ["-e", script]);
      const sessionId = result.stdout.trim();
      return { sessionId: sessionId || undefined };
    } catch {
      // Fallback: try without capturing ID
      const fallbackScript = `tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session of current tab
      write text "cd \\"${safePath}\\" && \\"${safeBin}\\" --agent ${safeAgent}"
    end tell
  end tell
end tell`;
      try {
        await exec("osascript", ["-e", fallbackScript]);
        return {};
      } catch {
        throw new Error("Failed to open iTerm2 tab");
      }
    }
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    if (!session.sessionId) {
      if (session.pid) return killPid(session.pid);
      return false;
    }

    const script = `tell application "iTerm2"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if id of s is "${shellEscape(session.sessionId)}" then
          close s
          return "closed"
        end if
      end repeat
    end repeat
  end repeat
  return "not_found"
end tell`;

    try {
      const result = await exec("osascript", ["-e", script], { nothrow: true });
      return result.stdout.trim() === "closed";
    } catch {
      return false;
    }
  }
}

// ─── Terminal.app (macOS) ────────────────────────────────────────────────────

class TerminalAppDriver implements TerminalDriver {
  readonly name = "terminal.app";

  detect(): boolean {
    if (process.platform !== "darwin") return false;
    if (process.env.TERM_PROGRAM === "Apple_Terminal") return true;
    const bundleId = process.env.__CFBundleIdentifier;
    if (bundleId?.includes("Terminal") || bundleId?.includes("apple.Terminal")) return true;
    return false;
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const safePath = shellEscape(opts.worktreePath);
    const safeBin = shellEscape(opts.opencodeBin);
    const safeAgent = shellEscape(opts.agent);

    // do script returns tab reference; we capture the window ID
    const script = `tell application "Terminal"
  activate
  set newTab to do script "cd \\"${safePath}\\" && \\"${safeBin}\\" --agent ${safeAgent}"
  return id of window of newTab
end tell`;

    try {
      const result = await exec("osascript", ["-e", script]);
      const windowId = result.stdout.trim();
      return { windowId: windowId || undefined };
    } catch {
      // Fallback: basic open without capturing ID
      try {
        await exec("open", ["-a", "Terminal", opts.worktreePath]);
        return {};
      } catch {
        throw new Error("Failed to open Terminal.app");
      }
    }
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    if (!session.windowId) {
      if (session.pid) return killPid(session.pid);
      return false;
    }

    const script = `tell application "Terminal"
  try
    close window id ${session.windowId}
    return "closed"
  on error
    return "not_found"
  end try
end tell`;

    try {
      const result = await exec("osascript", ["-e", script], { nothrow: true });
      return result.stdout.trim() === "closed";
    } catch {
      return false;
    }
  }
}

// ─── kitty (Linux/macOS) ─────────────────────────────────────────────────────

class KittyDriver implements TerminalDriver {
  readonly name = "kitty";

  detect(): boolean {
    return !!process.env.KITTY_WINDOW_ID || process.env.TERM_PROGRAM === "kitty";
  }

  /**
   * Check if kitty remote control is available.
   * Requires `allow_remote_control yes` in kitty.conf.
   */
  private async hasRemoteControl(): Promise<boolean> {
    try {
      await exec("kitty", ["@", "ls"], { timeout: 3000, nothrow: true });
      return true;
    } catch {
      return false;
    }
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const cmd = buildTabCommand(opts);

    // Prefer IPC tab creation if remote control is enabled
    if (await this.hasRemoteControl()) {
      try {
        const result = await exec("kitty", [
          "@",
          "launch",
          "--type=tab",
          `--cwd=${opts.worktreePath}`,
          `--title=Worktree: ${opts.branchName}`,
          "bash",
          "-c",
          cmd,
        ]);
        const tabId = result.stdout.trim();
        return { tabId: tabId || undefined };
      } catch {
        // Fall through to new-window approach
      }
    }

    // Fallback: open a new kitty window (captures PID)
    const child = spawn("kitty", [
      "--directory",
      opts.worktreePath,
      "--title",
      `Worktree: ${opts.branchName}`,
      "--",
      "bash",
      "-c",
      cmd,
    ], { cwd: opts.worktreePath });
    return { pid: child.pid ?? undefined };
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    // Try IPC close by tab ID
    if (session.tabId) {
      try {
        await exec("kitty", ["@", "close-tab", `--match=id:${session.tabId}`], { nothrow: true });
        return true;
      } catch {
        // Tab may not exist
      }
    }

    // Try IPC close by PID
    if (session.pid) {
      try {
        await exec("kitty", ["@", "close-window", `--match=pid:${session.pid}`], { nothrow: true });
        return true;
      } catch {
        // Fall through to kill
      }
    }

    // Fallback: kill PID
    if (session.pid) return killPid(session.pid);
    return false;
  }
}

// ─── wezterm ─────────────────────────────────────────────────────────────────

class WeztermDriver implements TerminalDriver {
  readonly name = "wezterm";

  detect(): boolean {
    return !!process.env.WEZTERM_PANE || process.env.TERM_PROGRAM === "WezTerm";
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const cmd = buildTabCommand(opts);

    // wezterm cli spawn opens a tab in the current window
    try {
      const result = await exec("wezterm", [
        "cli",
        "spawn",
        "--cwd",
        opts.worktreePath,
        "--",
        "bash",
        "-c",
        cmd,
      ]);
      const paneId = result.stdout.trim();
      return { paneId: paneId || undefined };
    } catch {
      // Fallback: wezterm start opens a new window
      const child = spawn("wezterm", [
        "start",
        "--cwd",
        opts.worktreePath,
        "--",
        "bash",
        "-c",
        cmd,
      ], { cwd: opts.worktreePath });
      return { pid: child.pid ?? undefined };
    }
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    if (session.paneId) {
      try {
        await exec("wezterm", ["cli", "kill-pane", "--pane-id", session.paneId], { nothrow: true });
        return true;
      } catch {
        // Pane may not exist
      }
    }
    if (session.pid) return killPid(session.pid);
    return false;
  }
}

// ─── Konsole (KDE) ───────────────────────────────────────────────────────────

class KonsoleDriver implements TerminalDriver {
  readonly name = "konsole";

  detect(): boolean {
    return !!process.env.KONSOLE_VERSION;
  }

  /** Find the qdbus binary (qdbus or qdbus6 on newer KDE). */
  private async findQdbus(): Promise<string | null> {
    const bin = await which("qdbus");
    if (bin) return "qdbus";
    const bin6 = await which("qdbus6");
    if (bin6) return "qdbus6";
    return null;
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const cmd = buildTabCommand(opts);
    const qdbus = await this.findQdbus();
    const service = process.env.KONSOLE_DBUS_SERVICE
      ? `org.kde.konsole-${process.env.KONSOLE_DBUS_SERVICE}`
      : "org.kde.konsole";

    // Try D-Bus new session
    if (qdbus) {
      try {
        const result = await exec(qdbus, [
          service,
          "/Windows/1",
          "newSession",
        ]);
        const sessionNum = result.stdout.trim();
        const dbusPath = `/Sessions/${sessionNum}`;

        // Set working directory and run command
        await exec(qdbus, [service, dbusPath, "setProfile", "Default"]);
        await exec(qdbus, [service, dbusPath, "runCommand", cmd]);
        return { dbusPath };
      } catch {
        // Fall through
      }
    }

    // Fallback: launch konsole with --new-tab
    try {
      const child = spawn("konsole", [
        "--new-tab",
        "--workdir",
        opts.worktreePath,
        "-e",
        "bash",
        "-c",
        cmd,
      ], { cwd: opts.worktreePath });
      return { pid: child.pid ?? undefined };
    } catch {
      throw new Error("Failed to open Konsole tab");
    }
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    if (session.dbusPath) {
      const qdbus = await this.findQdbus();
      const service = process.env.KONSOLE_DBUS_SERVICE
        ? `org.kde.konsole-${process.env.KONSOLE_DBUS_SERVICE}`
        : "org.kde.konsole";

      if (qdbus) {
        try {
          await exec(qdbus, [service, session.dbusPath, "close"], { nothrow: true });
          return true;
        } catch {
          // Session may not exist
        }
      }
    }
    if (session.pid) return killPid(session.pid);
    return false;
  }
}

// ─── GNOME Terminal ──────────────────────────────────────────────────────────

class GnomeTerminalDriver implements TerminalDriver {
  readonly name = "gnome-terminal";

  detect(): boolean {
    return !!process.env.GNOME_TERMINAL_SERVICE;
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const cmd = buildTabCommand(opts);

    // gnome-terminal --tab opens in the current window
    try {
      const child = spawn("gnome-terminal", [
        "--tab",
        `--working-directory=${opts.worktreePath}`,
        "--",
        "bash",
        "-c",
        cmd,
      ], { cwd: opts.worktreePath });
      return { pid: child.pid ?? undefined };
    } catch {
      // Fallback: open a new window
      const child = spawn("gnome-terminal", [
        `--working-directory=${opts.worktreePath}`,
        "--",
        "bash",
        "-c",
        cmd,
      ], { cwd: opts.worktreePath });
      return { pid: child.pid ?? undefined };
    }
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    // GNOME Terminal has no reliable tab-close API — kill PID
    if (session.pid) return killPid(session.pid);
    return false;
  }
}

// ─── Fallback (PID-based, always matches) ────────────────────────────────────

class FallbackDriver implements TerminalDriver {
  readonly name = "fallback";

  detect(): boolean {
    return true; // Always matches — catch-all
  }

  async openTab(opts: TabOpenOptions): Promise<Partial<TerminalSession>> {
    const cmd = buildTabCommand(opts);
    const platform = process.platform;

    // macOS: try generic open
    if (platform === "darwin") {
      try {
        await exec("open", ["-a", "Terminal", opts.worktreePath]);
        return {};
      } catch {
        // Fall through
      }
    }

    // Linux: try common terminals in order
    if (platform === "linux") {
      const terminals = [
        { name: "xterm", args: ["-e", "bash", "-c", cmd] },
        { name: "x-terminal-emulator", args: ["-e", "bash", "-c", cmd] },
      ];

      for (const t of terminals) {
        try {
          const child = spawn(t.name, t.args, { cwd: opts.worktreePath });
          return { pid: child.pid ?? undefined };
        } catch {
          continue;
        }
      }
    }

    // Windows: try Windows Terminal, then cmd
    if (platform === "win32") {
      // Try Windows Terminal first
      const wt = await which("wt.exe");
      if (wt) {
        try {
          const child = spawn("wt.exe", [
            "new-tab",
            "--startingDirectory",
            opts.worktreePath,
            "cmd",
            "/k",
            cmd,
          ], { cwd: opts.worktreePath });
          return { pid: child.pid ?? undefined };
        } catch {
          // Fall through to cmd
        }
      }

      try {
        await exec("cmd", ["/k", cmd], { cwd: opts.worktreePath });
        return {};
      } catch {
        // Nothing worked
      }
    }

    throw new Error(`Could not open terminal on ${platform}`);
  }

  async closeTab(session: TerminalSession): Promise<boolean> {
    if (session.pid) return killPid(session.pid);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Detection Registry
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Ordered list of terminal drivers. Detection runs first-to-last.
 *
 * Priority: multiplexers first (tmux), then terminal emulators, then fallback.
 * This ensures that if the user is in tmux inside iTerm2, we open a tmux window.
 */
const DRIVERS: TerminalDriver[] = [
  new TmuxDriver(),
  new ITerm2Driver(),
  new TerminalAppDriver(),
  new KittyDriver(),
  new WeztermDriver(),
  new KonsoleDriver(),
  new GnomeTerminalDriver(),
  new FallbackDriver(),
];

/** Map of driver name → driver instance for reverse lookup. */
const DRIVER_MAP = new Map<string, TerminalDriver>(
  DRIVERS.map((d) => [d.name, d]),
);

/**
 * Detect the active terminal emulator and return the matching driver.
 * Falls back to FallbackDriver if no specific terminal is detected.
 */
export function detectDriver(): TerminalDriver {
  for (const driver of DRIVERS) {
    if (driver.detect()) return driver;
  }
  // Should never reach here (FallbackDriver always matches)
  return new FallbackDriver();
}

/**
 * Get a driver by name (used when closing a tab from a persisted session).
 * Returns null if the driver name is unknown.
 */
export function getDriverByName(name: string): TerminalDriver | null {
  return DRIVER_MAP.get(name) ?? null;
}

/**
 * Close a terminal session using the appropriate driver.
 * Handles all modes (terminal, pty, background) with PID fallback.
 *
 * This is the main entry point for worktree_remove cleanup.
 */
export async function closeSession(session: TerminalSession): Promise<boolean> {
  if (session.mode === "terminal") {
    const driver = getDriverByName(session.terminal);
    if (driver) {
      const closed = await driver.closeTab(session);
      if (closed) return true;
    }
  }

  // Universal fallback: kill PID
  if (session.pid) return killPid(session.pid);
  return false;
}
