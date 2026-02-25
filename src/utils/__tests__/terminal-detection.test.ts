/**
 * Tests for the multi-strategy terminal detection chain.
 *
 * Covers:
 *   - New terminal drivers (Ghostty, Alacritty, Hyper, Rio)
 *   - detectTerminalDriver() — env, process-tree, frontmost-app, user-config, fallback
 *   - The detection chain never returns IDE drivers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  detectDriver,
  detectTerminalDriver,
  getDriverByName,
  isIDEDriver,
  detectFallbackDriver,
  type TerminalDetectionResult,
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

// Helper to clear all terminal-related env vars
function clearEnv() {
  const vars = [
    "VSCODE_PID", "VSCODE_CWD", "TERM_PROGRAM",
    "CURSOR_TRACE_ID", "CURSOR_SHELL_VERSION",
    "WINDSURF_PARENT_PROCESS", "WINDSURF_EDITOR",
    "TERMINAL_EMULATOR", "JETBRAINS_IDE",
    "ZED_TERM", "TERM", "TMUX",
    "ITERM_SESSION_ID", "__CFBundleIdentifier",
    "KITTY_WINDOW_ID", "WEZTERM_PANE",
    "KONSOLE_VERSION", "GNOME_TERMINAL_SERVICE",
    // New terminal env vars
    "GHOSTTY_RESOURCES_DIR",
    "ALACRITTY_WINDOW_ID", "ALACRITTY_LOG",
  ];
  for (const v of vars) {
    delete process.env[v];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// New Terminal Driver Detection (env vars)
// ═════════════════════════════════════════════════════════════════════════════

describe("New Terminal Drivers — env var detection", () => {
  beforeEach(() => {
    clearEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("Ghostty", () => {
    it("detects Ghostty via GHOSTTY_RESOURCES_DIR", () => {
      process.env.GHOSTTY_RESOURCES_DIR = "/usr/share/ghostty";
      const driver = detectDriver();
      expect(driver.name).toBe("ghostty");
    });

    it("detects Ghostty via TERM_PROGRAM=ghostty", () => {
      process.env.TERM_PROGRAM = "ghostty";
      const driver = detectDriver();
      expect(driver.name).toBe("ghostty");
    });

    it("getDriverByName returns ghostty driver", () => {
      const driver = getDriverByName("ghostty");
      expect(driver).not.toBeNull();
      expect(driver!.name).toBe("ghostty");
    });

    it("is NOT an IDE driver", () => {
      const driver = getDriverByName("ghostty")!;
      expect(isIDEDriver(driver)).toBe(false);
    });
  });

  describe("Alacritty", () => {
    it("detects Alacritty via ALACRITTY_WINDOW_ID", () => {
      process.env.ALACRITTY_WINDOW_ID = "12345";
      const driver = detectDriver();
      expect(driver.name).toBe("alacritty");
    });

    it("detects Alacritty via ALACRITTY_LOG", () => {
      process.env.ALACRITTY_LOG = "/tmp/alacritty.log";
      const driver = detectDriver();
      expect(driver.name).toBe("alacritty");
    });

    it("detects Alacritty via TERM_PROGRAM=alacritty", () => {
      process.env.TERM_PROGRAM = "alacritty";
      const driver = detectDriver();
      expect(driver.name).toBe("alacritty");
    });

    it("getDriverByName returns alacritty driver", () => {
      const driver = getDriverByName("alacritty");
      expect(driver).not.toBeNull();
      expect(driver!.name).toBe("alacritty");
    });

    it("is NOT an IDE driver", () => {
      const driver = getDriverByName("alacritty")!;
      expect(isIDEDriver(driver)).toBe(false);
    });
  });

  describe("Hyper", () => {
    it("detects Hyper via TERM_PROGRAM=Hyper", () => {
      process.env.TERM_PROGRAM = "Hyper";
      const driver = detectDriver();
      expect(driver.name).toBe("hyper");
    });

    it("getDriverByName returns hyper driver", () => {
      const driver = getDriverByName("hyper");
      expect(driver).not.toBeNull();
      expect(driver!.name).toBe("hyper");
    });

    it("is NOT an IDE driver", () => {
      const driver = getDriverByName("hyper")!;
      expect(isIDEDriver(driver)).toBe(false);
    });
  });

  describe("Rio", () => {
    it("detects Rio via TERM_PROGRAM=rio", () => {
      process.env.TERM_PROGRAM = "rio";
      const driver = detectDriver();
      expect(driver.name).toBe("rio");
    });

    it("getDriverByName returns rio driver", () => {
      const driver = getDriverByName("rio");
      expect(driver).not.toBeNull();
      expect(driver!.name).toBe("rio");
    });

    it("is NOT an IDE driver", () => {
      const driver = getDriverByName("rio")!;
      expect(isIDEDriver(driver)).toBe(false);
    });
  });

  describe("detectFallbackDriver includes new drivers", () => {
    it("returns ghostty when ghostty env is set", () => {
      process.env.GHOSTTY_RESOURCES_DIR = "/usr/share/ghostty";
      process.env.VSCODE_PID = "999"; // IDE also set — should be skipped
      const driver = detectFallbackDriver();
      expect(driver).not.toBeNull();
      expect(driver!.name).toBe("ghostty");
    });

    it("returns alacritty when alacritty env is set", () => {
      process.env.ALACRITTY_WINDOW_ID = "123";
      const driver = detectFallbackDriver();
      expect(driver).not.toBeNull();
      expect(driver!.name).toBe("alacritty");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// detectTerminalDriver() — Multi-Strategy Chain
// ═════════════════════════════════════════════════════════════════════════════

describe("detectTerminalDriver — multi-strategy chain", () => {
  beforeEach(() => {
    clearEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("Strategy 1: Environment variables", () => {
    it("returns terminal driver when terminal env var is set", async () => {
      process.env.GHOSTTY_RESOURCES_DIR = "/usr/share/ghostty";
      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("ghostty");
      expect(result.strategy).toBe("env");
    });

    it("returns tmux when TMUX is set", async () => {
      process.env.TMUX = "/tmp/tmux-1000/default,12345,0";
      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("tmux");
      expect(result.strategy).toBe("env");
    });

    it("skips IDE drivers even when IDE env vars are set", async () => {
      process.env.VSCODE_PID = "12345";
      process.env.GHOSTTY_RESOURCES_DIR = "/usr/share/ghostty";
      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("ghostty");
      expect(result.strategy).toBe("env");
      // Verify it NEVER returns an IDE driver
      expect(isIDEDriver(result.driver)).toBe(false);
    });

    it("skips IDE drivers when ONLY IDE env vars are set (falls to next strategy)", async () => {
      process.env.VSCODE_PID = "12345";
      // No terminal env vars → will fall through env to process-tree

      // Mock exec to fail (no process tree match)
      vi.mocked(shell.exec).mockRejectedValue(new Error("no match"));

      const result = await detectTerminalDriver();
      // Should NOT return vscode — should fall to fallback
      expect(result.driver.name).not.toBe("vscode");
      expect(isIDEDriver(result.driver)).toBe(false);
    });
  });

  describe("Strategy 2: Process-tree detection", () => {
    it("detects terminal from parent process on macOS", async () => {
      // No terminal env vars set — will skip to process-tree strategy
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

      // Mock ps output: parent PID + process name
      vi.mocked(shell.exec).mockResolvedValueOnce({
        stdout: "  1234 /Applications/Ghostty.app/Contents/MacOS/ghostty",
        stderr: "",
        exitCode: 0,
      });

      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("ghostty");
      expect(result.strategy).toBe("process-tree");
      expect(result.detail).toContain("ghostty");

      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });

    it("detects iTerm2 from parent process", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

      vi.mocked(shell.exec).mockResolvedValueOnce({
        stdout: "  500 /Applications/iTerm.app/Contents/MacOS/iTerm2",
        stderr: "",
        exitCode: 0,
      });

      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("iterm2");
      expect(result.strategy).toBe("process-tree");

      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });

    it("walks up the process tree when first parent doesn't match", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

      // First call: parent is bash (no match)
      vi.mocked(shell.exec).mockResolvedValueOnce({
        stdout: "  1000 bash",
        stderr: "",
        exitCode: 0,
      });
      // Second call: grandparent is kitty (match!)
      vi.mocked(shell.exec).mockResolvedValueOnce({
        stdout: "  500 kitty",
        stderr: "",
        exitCode: 0,
      });

      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("kitty");
      expect(result.strategy).toBe("process-tree");

      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });
  });

  describe("Strategy 3: Frontmost app detection (macOS)", () => {
    it("detects frontmost terminal app on macOS", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

      // Process tree fails (returns no match)
      vi.mocked(shell.exec).mockRejectedValueOnce(new Error("ps failed"));

      // Frontmost app returns Ghostty bundle ID
      vi.mocked(shell.exec).mockResolvedValueOnce({
        stdout: "com.mitchellh.ghostty\n",
        stderr: "",
        exitCode: 0,
      });

      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("ghostty");
      expect(result.strategy).toBe("frontmost-app");
      expect(result.detail).toContain("com.mitchellh.ghostty");

      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });

    it("detects iTerm2 as frontmost app", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });

      vi.mocked(shell.exec).mockRejectedValueOnce(new Error("ps failed"));
      vi.mocked(shell.exec).mockResolvedValueOnce({
        stdout: "com.googlecode.iterm2\n",
        stderr: "",
        exitCode: 0,
      });

      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("iterm2");
      expect(result.strategy).toBe("frontmost-app");

      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });

    it("skips frontmost-app on non-macOS", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux", configurable: true });

      // Process tree fails
      vi.mocked(shell.exec).mockRejectedValue(new Error("no match"));

      const result = await detectTerminalDriver();
      // Should fall to fallback — no frontmost-app on Linux
      expect(result.strategy).not.toBe("frontmost-app");

      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    });
  });

  describe("Strategy 5: Fallback", () => {
    it("returns fallback when all strategies fail", async () => {
      // No env vars, no process tree, no frontmost app, no config
      vi.mocked(shell.exec).mockRejectedValue(new Error("no match"));

      const result = await detectTerminalDriver();
      expect(result.driver.name).toBe("fallback");
      expect(result.strategy).toBe("fallback");
      expect(result.detail).toBe("no terminal detected");
    });
  });

  describe("Core invariant: never returns IDE driver", () => {
    const ideEnvConfigs = [
      { name: "VS Code", env: { VSCODE_PID: "12345" } },
      { name: "Cursor", env: { CURSOR_TRACE_ID: "abc" } },
      { name: "Windsurf", env: { WINDSURF_EDITOR: "1" } },
      { name: "Zed", env: { ZED_TERM: "1" } },
      { name: "JetBrains", env: { JETBRAINS_IDE: "WebStorm" } },
    ];

    for (const config of ideEnvConfigs) {
      it(`never returns ${config.name} driver`, async () => {
        for (const [key, value] of Object.entries(config.env)) {
          process.env[key] = value;
        }
        vi.mocked(shell.exec).mockRejectedValue(new Error("no match"));

        const result = await detectTerminalDriver();
        expect(isIDEDriver(result.driver)).toBe(false);
        expect(result.driver.name).not.toBe("vscode");
        expect(result.driver.name).not.toBe("cursor");
        expect(result.driver.name).not.toBe("windsurf");
        expect(result.driver.name).not.toBe("zed");
        expect(result.driver.name).not.toBe("jetbrains");
      });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TerminalDetectionResult shape
// ═════════════════════════════════════════════════════════════════════════════

describe("TerminalDetectionResult", () => {
  beforeEach(() => {
    clearEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("includes strategy and detail fields", async () => {
    process.env.KITTY_WINDOW_ID = "1";
    const result = await detectTerminalDriver();
    expect(result).toHaveProperty("driver");
    expect(result).toHaveProperty("strategy");
    expect(result).toHaveProperty("detail");
    expect(typeof result.strategy).toBe("string");
  });

  it("env strategy includes driver name in detail", async () => {
    process.env.WEZTERM_PANE = "1";
    const result = await detectTerminalDriver();
    expect(result.strategy).toBe("env");
    expect(result.detail).toContain("wezterm");
  });
});
