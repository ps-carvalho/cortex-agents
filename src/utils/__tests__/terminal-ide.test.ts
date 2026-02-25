import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  detectDriver,
  getDriverByName,
  detectIDE as detectTerminalIDE,
  isIDECliAvailable,
  isIDEDriver,
  detectFallbackDriver,
  getAvailableIDEs,
  writeSession,
  readSession,
  type TerminalSession,
} from "../terminal.js";
import * as shell from "../shell.js";

// Store original env to restore after each test
const originalEnv = { ...process.env };

// Mock shell functions
vi.mock("../shell.js", () => ({
  exec: vi.fn(),
  shellEscape: vi.fn((str: string) => str.replace(/"/g, '\\"')),
  spawn: vi.fn(() => ({ pid: 12345 })),
  which: vi.fn(),
}));

describe("IDE Driver Detection", () => {
  beforeEach(() => {
    // Clear IDE-related env vars before each test
    delete process.env.VSCODE_PID;
    delete process.env.VSCODE_CWD;
    delete process.env.TERM_PROGRAM;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.CURSOR_SHELL_VERSION;
    delete process.env.WINDSURF_PARENT_PROCESS;
    delete process.env.WINDSURF_EDITOR;
    delete process.env.TERMINAL_EMULATOR;
    delete process.env.JETBRAINS_IDE;
    delete process.env.ZED_TERM;
    delete process.env.TERM;
    delete process.env.TMUX;
    delete process.env.ITERM_SESSION_ID;
    delete process.env.__CFBundleIdentifier;
    delete process.env.KITTY_WINDOW_ID;
    delete process.env.WEZTERM_PANE;
    delete process.env.KONSOLE_VERSION;
    delete process.env.GNOME_TERMINAL_SERVICE;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    Object.assign(process.env, originalEnv);
  });

  describe("detectDriver", () => {
    it("detects VS Code as highest priority IDE", () => {
      process.env.VSCODE_PID = "12345";
      process.env.TERM = "xterm-256color";
      const driver = detectDriver();
      expect(driver.name).toBe("vscode");
    });

    it("detects Cursor when VS Code env vars not set", () => {
      process.env.CURSOR_TRACE_ID = "abc-123";
      process.env.TERM = "xterm-256color";
      const driver = detectDriver();
      expect(driver.name).toBe("cursor");
    });

    it("detects Windsurf when higher priority IDEs not set", () => {
      process.env.WINDSURF_EDITOR = "1";
      process.env.TERM = "xterm-256color";
      const driver = detectDriver();
      expect(driver.name).toBe("windsurf");
    });

    it("detects Zed via ZED_TERM", () => {
      process.env.ZED_TERM = "1";
      process.env.TERM = "xterm-256color";
      const driver = detectDriver();
      expect(driver.name).toBe("zed");
    });

    it("detects Zed via TERM_PROGRAM", () => {
      process.env.TERM_PROGRAM = "zed";
      const driver = detectDriver();
      expect(driver.name).toBe("zed");
    });

    it("detects JetBrains via TERMINAL_EMULATOR", () => {
      process.env.TERMINAL_EMULATOR = "JetBrains IdeaTerminal";
      process.env.TERM = "xterm-256color";
      const driver = detectDriver();
      expect(driver.name).toBe("jetbrains");
    });

    it("detects JetBrains via JETBRAINS_IDE", () => {
      process.env.JETBRAINS_IDE = "WebStorm";
      process.env.TERM = "xterm-256color";
      const driver = detectDriver();
      expect(driver.name).toBe("jetbrains");
    });

    it("detects tmux when no IDE detected", () => {
      process.env.TMUX = "/tmp/tmux-1000/default,12345,0";
      const driver = detectDriver();
      expect(driver.name).toBe("tmux");
    });

    it("detects iTerm2 on macOS", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
      
      process.env.TERM_PROGRAM = "iTerm.app";
      const driver = detectDriver();
      expect(driver.name).toBe("iterm2");
      
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });

    it("detects Terminal.app on macOS", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
      
      process.env.TERM_PROGRAM = "Apple_Terminal";
      const driver = detectDriver();
      expect(driver.name).toBe("terminal.app");
      
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });

    it("detects kitty", () => {
      process.env.KITTY_WINDOW_ID = "1";
      const driver = detectDriver();
      expect(driver.name).toBe("kitty");
    });

    it("detects wezterm", () => {
      process.env.WEZTERM_PANE = "1";
      const driver = detectDriver();
      expect(driver.name).toBe("wezterm");
    });

    it("detects konsole", () => {
      process.env.KONSOLE_VERSION = "23.08.0";
      const driver = detectDriver();
      expect(driver.name).toBe("konsole");
    });

    it("detects gnome-terminal", () => {
      process.env.GNOME_TERMINAL_SERVICE = "1";
      const driver = detectDriver();
      expect(driver.name).toBe("gnome-terminal");
    });

    it("falls back to fallback driver when nothing detected", () => {
      // No terminal env vars set
      const driver = detectDriver();
      expect(driver.name).toBe("fallback");
    });
  });

  describe("getDriverByName", () => {
    it("returns driver for known names", () => {
      expect(getDriverByName("vscode")?.name).toBe("vscode");
      expect(getDriverByName("cursor")?.name).toBe("cursor");
      expect(getDriverByName("windsurf")?.name).toBe("windsurf");
      expect(getDriverByName("zed")?.name).toBe("zed");
      expect(getDriverByName("jetbrains")?.name).toBe("jetbrains");
      expect(getDriverByName("tmux")?.name).toBe("tmux");
      expect(getDriverByName("iterm2")?.name).toBe("iterm2");
      expect(getDriverByName("kitty")?.name).toBe("kitty");
      expect(getDriverByName("wezterm")?.name).toBe("wezterm");
      expect(getDriverByName("konsole")?.name).toBe("konsole");
      expect(getDriverByName("gnome-terminal")?.name).toBe("gnome-terminal");
      expect(getDriverByName("fallback")?.name).toBe("fallback");
    });

    it("returns null for unknown driver name", () => {
      expect(getDriverByName("nonexistent")).toBeNull();
    });
  });

  describe("detectTerminalIDE", () => {
    it("returns VS Code driver when detected", () => {
      process.env.VSCODE_PID = "12345";
      const driver = detectTerminalIDE();
      expect(driver?.name).toBe("vscode");
    });

    it("returns Cursor driver when detected", () => {
      process.env.CURSOR_TRACE_ID = "abc-123";
      const driver = detectTerminalIDE();
      expect(driver?.name).toBe("cursor");
    });

    it("returns Windsurf driver when detected", () => {
      process.env.WINDSURF_EDITOR = "1";
      const driver = detectTerminalIDE();
      expect(driver?.name).toBe("windsurf");
    });

    it("returns Zed driver when detected", () => {
      process.env.ZED_TERM = "1";
      const driver = detectTerminalIDE();
      expect(driver?.name).toBe("zed");
    });

    it("returns JetBrains driver when detected", () => {
      process.env.JETBRAINS_IDE = "WebStorm";
      const driver = detectTerminalIDE();
      expect(driver?.name).toBe("jetbrains");
    });

    it("returns null when no IDE detected (tmux case)", () => {
      process.env.TMUX = "/tmp/tmux-1000/default,12345,0";
      const driver = detectTerminalIDE();
      expect(driver).toBeNull();
    });

    it("returns null when in standalone terminal", () => {
      process.env.TERM_PROGRAM = "iTerm.app";
      const driver = detectTerminalIDE();
      expect(driver).toBeNull();
    });

    it("returns null when no terminal detected", () => {
      // No env vars set
      const driver = detectTerminalIDE();
      expect(driver).toBeNull();
    });
  });
});

describe("isIDECliAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when VS Code CLI is available", async () => {
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/code");
    const result = await isIDECliAvailable("vscode");
    expect(result).toBe(true);
    expect(shell.which).toHaveBeenCalledWith("code");
  });

  it("returns true when Cursor CLI is available", async () => {
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/cursor");
    const result = await isIDECliAvailable("cursor");
    expect(result).toBe(true);
    expect(shell.which).toHaveBeenCalledWith("cursor");
  });

  it("returns true when Windsurf CLI is available", async () => {
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/windsurf");
    const result = await isIDECliAvailable("windsurf");
    expect(result).toBe(true);
    expect(shell.which).toHaveBeenCalledWith("windsurf");
  });

  it("returns true when Zed CLI is available", async () => {
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/zed");
    const result = await isIDECliAvailable("zed");
    expect(result).toBe(true);
    expect(shell.which).toHaveBeenCalledWith("zed");
  });

  it("returns false when CLI is not available", async () => {
    vi.mocked(shell.which).mockResolvedValueOnce(null);
    const result = await isIDECliAvailable("vscode");
    expect(result).toBe(false);
  });

  it("returns false for unknown IDE", async () => {
    const result = await isIDECliAvailable("unknown_ide");
    expect(result).toBe(false);
  });

  it("uses 'idea' CLI for JetBrains", async () => {
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/idea");
    const result = await isIDECliAvailable("jetbrains");
    expect(result).toBe(true);
    expect(shell.which).toHaveBeenCalledWith("idea");
  });
});

describe("getAvailableIDEs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of available IDEs", async () => {
    vi.mocked(shell.which)
      .mockResolvedValueOnce("/usr/local/bin/code") // vscode
      .mockResolvedValueOnce(null) // cursor
      .mockResolvedValueOnce("/usr/local/bin/windsurf") // windsurf
      .mockResolvedValueOnce(null); // zed

    const result = await getAvailableIDEs();
    expect(result).toEqual(["vscode", "windsurf"]);
  });

  it("returns empty array when no IDE CLIs available", async () => {
    vi.mocked(shell.which)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await getAvailableIDEs();
    expect(result).toEqual([]);
  });

  it("returns all IDEs when all CLIs available", async () => {
    vi.mocked(shell.which)
      .mockResolvedValueOnce("/usr/local/bin/code")
      .mockResolvedValueOnce("/usr/local/bin/cursor")
      .mockResolvedValueOnce("/usr/local/bin/windsurf")
      .mockResolvedValueOnce("/usr/local/bin/zed");

    const result = await getAvailableIDEs();
    expect(result).toEqual(["vscode", "cursor", "windsurf", "zed"]);
  });
});

describe("isIDEDriver", () => {
  it("returns true for VS Code driver", () => {
    const driver = getDriverByName("vscode")!;
    expect(isIDEDriver(driver)).toBe(true);
  });

  it("returns true for Cursor driver", () => {
    const driver = getDriverByName("cursor")!;
    expect(isIDEDriver(driver)).toBe(true);
  });

  it("returns true for Windsurf driver", () => {
    const driver = getDriverByName("windsurf")!;
    expect(isIDEDriver(driver)).toBe(true);
  });

  it("returns true for Zed driver", () => {
    const driver = getDriverByName("zed")!;
    expect(isIDEDriver(driver)).toBe(true);
  });

  it("returns true for JetBrains driver", () => {
    const driver = getDriverByName("jetbrains")!;
    expect(isIDEDriver(driver)).toBe(true);
  });

  it("returns false for tmux driver", () => {
    const driver = getDriverByName("tmux")!;
    expect(isIDEDriver(driver)).toBe(false);
  });

  it("returns false for iTerm2 driver", () => {
    const driver = getDriverByName("iterm2")!;
    expect(isIDEDriver(driver)).toBe(false);
  });

  it("returns false for kitty driver", () => {
    const driver = getDriverByName("kitty")!;
    expect(isIDEDriver(driver)).toBe(false);
  });

  it("returns false for fallback driver", () => {
    const driver = getDriverByName("fallback")!;
    expect(isIDEDriver(driver)).toBe(false);
  });
});

describe("detectFallbackDriver", () => {
  beforeEach(() => {
    delete process.env.VSCODE_PID;
    delete process.env.VSCODE_CWD;
    delete process.env.TERM_PROGRAM;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.CURSOR_SHELL_VERSION;
    delete process.env.WINDSURF_PARENT_PROCESS;
    delete process.env.WINDSURF_EDITOR;
    delete process.env.TERMINAL_EMULATOR;
    delete process.env.JETBRAINS_IDE;
    delete process.env.ZED_TERM;
    delete process.env.TERM;
    delete process.env.TMUX;
    delete process.env.ITERM_SESSION_ID;
    delete process.env.__CFBundleIdentifier;
    delete process.env.KITTY_WINDOW_ID;
    delete process.env.WEZTERM_PANE;
    delete process.env.KONSOLE_VERSION;
    delete process.env.GNOME_TERMINAL_SERVICE;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("skips IDE drivers and returns tmux when in tmux", () => {
    process.env.VSCODE_PID = "12345"; // IDE detected
    process.env.TMUX = "/tmp/tmux-1000/default,12345,0";
    const driver = detectFallbackDriver();
    expect(driver).not.toBeNull();
    expect(driver!.name).toBe("tmux");
  });

  it("skips IDE drivers and returns iTerm2 on macOS", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

    process.env.VSCODE_PID = "12345"; // IDE detected
    process.env.TERM_PROGRAM = "iTerm.app";
    const driver = detectFallbackDriver();
    expect(driver).not.toBeNull();
    expect(driver!.name).toBe("iterm2");

    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });

  it("returns fallback driver when no terminal emulator detected", () => {
    // Only IDE env vars set, no terminal emulator
    process.env.VSCODE_PID = "12345";
    const driver = detectFallbackDriver();
    expect(driver).not.toBeNull();
    expect(driver!.name).toBe("fallback");
  });

  it("returns kitty when kitty is detected", () => {
    process.env.KITTY_WINDOW_ID = "1";
    const driver = detectFallbackDriver();
    expect(driver).not.toBeNull();
    expect(driver!.name).toBe("kitty");
  });

  it("returns wezterm when wezterm is detected", () => {
    process.env.WEZTERM_PANE = "1";
    const driver = detectFallbackDriver();
    expect(driver).not.toBeNull();
    expect(driver!.name).toBe("wezterm");
  });

  it("never returns an IDE driver", () => {
    // Set all IDE env vars
    process.env.VSCODE_PID = "12345";
    process.env.CURSOR_TRACE_ID = "abc";
    process.env.WINDSURF_EDITOR = "1";
    process.env.ZED_TERM = "1";
    process.env.JETBRAINS_IDE = "WebStorm";

    const driver = detectFallbackDriver();
    expect(driver).not.toBeNull();
    // Should be fallback since no terminal emulator env vars are set
    expect(["tmux", "iterm2", "terminal.app", "kitty", "wezterm", "konsole", "gnome-terminal", "fallback"]).toContain(driver!.name);
  });
});

describe("Session I/O", () => {
  const testSession: TerminalSession = {
    terminal: "vscode",
    platform: "darwin",
    mode: "terminal",
    branch: "feature/test",
    agent: "build",
    worktreePath: "/tmp/worktree",
    startedAt: "2024-01-01T00:00:00.000Z",
    sessionId: "vscode-feature-test",
  };

  describe("writeSession and readSession", () => {
    it("writes and reads session data", async () => {
      const fs = await import("fs");
      const tmpDir = `/tmp/cortex-test-session-${Date.now()}`;
      
      writeSession(tmpDir, testSession);
      const read = readSession(tmpDir);
      
      expect(read).toEqual(testSession);
      
      // Cleanup
      fs.rmSync(`${tmpDir}/.cortex`, { recursive: true, force: true });
    });

    it("returns null when session file does not exist", () => {
      const result = readSession("/nonexistent/path");
      expect(result).toBeNull();
    });

    it("returns null when session file is invalid JSON", async () => {
      const fs = await import("fs");
      const tmpDir = `/tmp/cortex-test-invalid-${Date.now()}`;
      const cortexDir = `${tmpDir}/.cortex`;
      
      fs.mkdirSync(cortexDir, { recursive: true });
      fs.writeFileSync(`${cortexDir}/.terminal-session`, "invalid json {{{");
      
      const result = readSession(tmpDir);
      expect(result).toBeNull();
      
      // Cleanup
      fs.rmSync(cortexDir, { recursive: true, force: true });
    });
  });
});
