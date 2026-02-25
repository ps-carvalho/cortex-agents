import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  detectIDE,
  detectIDEWithCLICheck,
  getIDEOpenCommand,
  getIDECliBinary,
  getInstallHint,
  isInIDETerminal,
  generateEnvironmentRecommendations,
  formatEnvironmentReport,
  type IDEDetection,
  type IDEType,
} from "../ide.js";
import * as shell from "../shell.js";

// Mock shell.which for async CLI checks
vi.mock("../shell.js", async () => {
  const actual = await vi.importActual<typeof import("../shell.js")>("../shell.js");
  return {
    ...actual,
    which: vi.fn(),
  };
});

// Store original env to restore after each test
const originalEnv = { ...process.env };

describe("detectIDE", () => {
  beforeEach(() => {
    // Clear IDE-related env vars before each test
    delete process.env.VSCODE_PID;
    delete process.env.VSCODE_CWD;
    delete process.env.VSCODE_VERSION;
    delete process.env.TERM_PROGRAM;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.CURSOR_SHELL_VERSION;
    delete process.env.WINDSURF_PARENT_PROCESS;
    delete process.env.WINDSURF_EDITOR;
    delete process.env.TERMINAL_EMULATOR;
    delete process.env.JETBRAINS_IDE;
    delete process.env.JETBRAINS_IDE_NAME;
    delete process.env.ZED_TERM;
    delete process.env.TERM;
    delete process.env.TMUX;
  });

  afterEach(() => {
    // Restore original environment
    Object.assign(process.env, originalEnv);
  });

  describe("VS Code detection", () => {
    it("detects VS Code via VSCODE_PID", () => {
      process.env.VSCODE_PID = "12345";
      const result = detectIDE();
      expect(result.type).toBe("vscode");
      expect(result.name).toBe("Visual Studio Code");
      expect(result.hasIntegratedTerminal).toBe(true);
      expect(result.canOpenInTerminal).toBe(true);
      expect(result.canOpenInWindow).toBe(true);
      expect(result.detectionSource).toBe("VSCODE_PID");
    });

    it("detects VS Code via VSCODE_CWD", () => {
      process.env.VSCODE_CWD = "/Users/test/project";
      const result = detectIDE();
      expect(result.type).toBe("vscode");
      expect(result.detectionSource).toBe("VSCODE_CWD");
    });

    it("detects VS Code via TERM_PROGRAM", () => {
      process.env.TERM_PROGRAM = "vscode";
      const result = detectIDE();
      expect(result.type).toBe("vscode");
      expect(result.detectionSource).toBe("TERM_PROGRAM");
    });

    it("captures VS Code version when available", () => {
      process.env.VSCODE_PID = "12345";
      process.env.VSCODE_VERSION = "1.85.0";
      const result = detectIDE();
      expect(result.version).toBe("1.85.0");
    });

    it("prioritizes VSCODE_PID over other detection methods", () => {
      process.env.VSCODE_PID = "12345";
      process.env.VSCODE_CWD = "/some/path";
      process.env.TERM_PROGRAM = "vscode";
      const result = detectIDE();
      expect(result.detectionSource).toBe("VSCODE_PID");
    });
  });

  describe("Cursor detection", () => {
    it("detects Cursor via CURSOR_TRACE_ID", () => {
      process.env.CURSOR_TRACE_ID = "abc-123-def";
      const result = detectIDE();
      expect(result.type).toBe("cursor");
      expect(result.name).toBe("Cursor");
      expect(result.hasIntegratedTerminal).toBe(true);
      expect(result.canOpenInWindow).toBe(true);
      expect(result.detectionSource).toBe("CURSOR_TRACE_ID");
    });

    it("detects Cursor via CURSOR_SHELL_VERSION", () => {
      process.env.CURSOR_SHELL_VERSION = "0.1.0";
      const result = detectIDE();
      expect(result.type).toBe("cursor");
      expect(result.version).toBe("0.1.0");
      expect(result.detectionSource).toBe("CURSOR_SHELL_VERSION");
    });
  });

  describe("Windsurf detection", () => {
    it("detects Windsurf via WINDSURF_PARENT_PROCESS", () => {
      process.env.WINDSURF_PARENT_PROCESS = "windsurf";
      const result = detectIDE();
      expect(result.type).toBe("windsurf");
      expect(result.name).toBe("Windsurf");
      expect(result.hasIntegratedTerminal).toBe(true);
      expect(result.canOpenInWindow).toBe(true);
      expect(result.detectionSource).toBe("WINDSURF_PARENT_PROCESS");
    });

    it("detects Windsurf via WINDSURF_EDITOR", () => {
      process.env.WINDSURF_EDITOR = "1";
      const result = detectIDE();
      expect(result.type).toBe("windsurf");
      expect(result.detectionSource).toBe("WINDSURF_EDITOR");
    });
  });

  describe("JetBrains detection", () => {
    it("detects JetBrains via TERMINAL_EMULATOR containing 'JetBrains'", () => {
      process.env.TERMINAL_EMULATOR = "JetBrains IdeaTerminal";
      const result = detectIDE();
      expect(result.type).toBe("jetbrains");
      expect(result.name).toBe("JetBrains IDE");
      expect(result.hasIntegratedTerminal).toBe(true);
      expect(result.canOpenInWindow).toBe(false); // JB doesn't have CLI window opening
      expect(result.detectionSource).toBe("TERMINAL_EMULATOR");
    });

    it("detects JetBrains via JETBRAINS_IDE", () => {
      process.env.JETBRAINS_IDE = "WebStorm";
      const result = detectIDE();
      expect(result.type).toBe("jetbrains");
      expect(result.detectionSource).toBe("JETBRAINS_IDE");
    });

    it("uses JETBRAINS_IDE_NAME for name when available", () => {
      process.env.JETBRAINS_IDE = "WebStorm";
      process.env.JETBRAINS_IDE_NAME = "WebStorm 2024.1";
      const result = detectIDE();
      expect(result.name).toBe("WebStorm 2024.1");
    });
  });

  describe("Zed detection", () => {
    it("detects Zed via ZED_TERM", () => {
      process.env.ZED_TERM = "1";
      const result = detectIDE();
      expect(result.type).toBe("zed");
      expect(result.name).toBe("Zed");
      expect(result.hasIntegratedTerminal).toBe(true);
      expect(result.canOpenInWindow).toBe(true);
      expect(result.detectionSource).toBe("ZED_TERM");
    });

    it("detects Zed via TERM_PROGRAM", () => {
      process.env.TERM_PROGRAM = "zed";
      const result = detectIDE();
      expect(result.type).toBe("zed");
      expect(result.detectionSource).toBe("TERM_PROGRAM");
    });
  });

  describe("Terminal detection", () => {
    it("detects terminal-only via TERM_PROGRAM", () => {
      process.env.TERM_PROGRAM = "iTerm.app";
      const result = detectIDE();
      expect(result.type).toBe("terminal");
      expect(result.name).toBe("iTerm.app");
      expect(result.hasIntegratedTerminal).toBe(false);
      expect(result.canOpenInTerminal).toBe(false);
      expect(result.canOpenInWindow).toBe(true);
      expect(result.detectionSource).toBe("TERM_PROGRAM");
    });

    it("detects terminal-only via TMUX", () => {
      process.env.TMUX = "/tmp/tmux-1000/default,12345,0";
      const result = detectIDE();
      expect(result.type).toBe("terminal");
      expect(result.detectionSource).toBe("TMUX");
    });

    it("detects terminal-only via TERM", () => {
      process.env.TERM = "xterm-256color";
      const result = detectIDE();
      expect(result.type).toBe("terminal");
      expect(result.name).toBe("xterm-256color");
      expect(result.detectionSource).toBe("TERM");
    });

    it("prioritizes TERM_PROGRAM over TMUX and TERM", () => {
      process.env.TERM_PROGRAM = "iTerm.app";
      process.env.TMUX = "/tmp/tmux-1000/default,12345,0";
      process.env.TERM = "xterm-256color";
      const result = detectIDE();
      expect(result.detectionSource).toBe("TERM_PROGRAM");
    });
  });

  describe("Unknown detection", () => {
    it("returns unknown when no env vars are set", () => {
      // Clear all relevant env vars
      const result = detectIDE();
      expect(result.type).toBe("unknown");
      expect(result.name).toBe("Unknown");
      expect(result.hasIntegratedTerminal).toBe(false);
      expect(result.canOpenInTerminal).toBe(false);
      expect(result.canOpenInWindow).toBe(true);
      expect(result.detectionSource).toBe("none");
    });
  });

  describe("Detection priority", () => {
    it("prioritizes VS Code over Cursor env vars", () => {
      process.env.VSCODE_PID = "12345";
      process.env.CURSOR_TRACE_ID = "abc-123";
      const result = detectIDE();
      expect(result.type).toBe("vscode");
    });

    it("prioritizes Cursor over Windsurf env vars", () => {
      process.env.CURSOR_TRACE_ID = "abc-123";
      process.env.WINDSURF_EDITOR = "1";
      const result = detectIDE();
      expect(result.type).toBe("cursor");
    });

    it("prioritizes Windsurf over JetBrains env vars", () => {
      process.env.WINDSURF_EDITOR = "1";
      process.env.JETBRAINS_IDE = "WebStorm";
      const result = detectIDE();
      expect(result.type).toBe("windsurf");
    });

    it("prioritizes JetBrains over Zed env vars", () => {
      process.env.JETBRAINS_IDE = "WebStorm";
      process.env.ZED_TERM = "1";
      const result = detectIDE();
      expect(result.type).toBe("jetbrains");
    });

    it("prioritizes Zed over terminal detection", () => {
      process.env.ZED_TERM = "1";
      process.env.TERM_PROGRAM = "iTerm.app";
      const result = detectIDE();
      expect(result.type).toBe("zed");
    });
  });
});

describe("getIDEOpenCommand", () => {
  it("returns correct command for VS Code", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const result = getIDEOpenCommand(ide, "/path/to/worktree");
    expect(result).toBe('code --new-window "/path/to/worktree"');
  });

  it("returns correct command for Cursor", () => {
    const ide: IDEDetection = {
      type: "cursor",
      name: "Cursor",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "CURSOR_TRACE_ID",
    };
    const result = getIDEOpenCommand(ide, "/path/to/worktree");
    expect(result).toBe('cursor --new-window "/path/to/worktree"');
  });

  it("returns correct command for Windsurf", () => {
    const ide: IDEDetection = {
      type: "windsurf",
      name: "Windsurf",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "WINDSURF_EDITOR",
    };
    const result = getIDEOpenCommand(ide, "/path/to/worktree");
    expect(result).toBe('windsurf "/path/to/worktree"');
  });

  it("returns correct command for Zed", () => {
    const ide: IDEDetection = {
      type: "zed",
      name: "Zed",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "ZED_TERM",
    };
    const result = getIDEOpenCommand(ide, "/path/to/worktree");
    expect(result).toBe('zed "/path/to/worktree"');
  });

  it("returns null for JetBrains (no CLI available)", () => {
    const ide: IDEDetection = {
      type: "jetbrains",
      name: "WebStorm",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: false,
      detectionSource: "JETBRAINS_IDE",
    };
    const result = getIDEOpenCommand(ide, "/path/to/worktree");
    expect(result).toBeNull();
  });

  it("returns null for terminal-only detection", () => {
    const ide: IDEDetection = {
      type: "terminal",
      name: "iTerm.app",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: "TERM_PROGRAM",
    };
    const result = getIDEOpenCommand(ide, "/path/to/worktree");
    expect(result).toBeNull();
  });

  it("returns null for unknown detection", () => {
    const ide: IDEDetection = {
      type: "unknown",
      name: "Unknown",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: "none",
    };
    const result = getIDEOpenCommand(ide, "/path/to/worktree");
    expect(result).toBeNull();
  });

  it("properly quotes paths with spaces", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const result = getIDEOpenCommand(ide, "/path/to/my worktree");
    expect(result).toBe('code --new-window "/path/to/my worktree"');
  });
});

describe("getIDECliBinary", () => {
  it("returns 'code' for VS Code", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    expect(getIDECliBinary(ide)).toBe("code");
  });

  it("returns 'cursor' for Cursor", () => {
    const ide: IDEDetection = {
      type: "cursor",
      name: "Cursor",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "CURSOR_TRACE_ID",
    };
    expect(getIDECliBinary(ide)).toBe("cursor");
  });

  it("returns 'windsurf' for Windsurf", () => {
    const ide: IDEDetection = {
      type: "windsurf",
      name: "Windsurf",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "WINDSURF_EDITOR",
    };
    expect(getIDECliBinary(ide)).toBe("windsurf");
  });

  it("returns 'zed' for Zed", () => {
    const ide: IDEDetection = {
      type: "zed",
      name: "Zed",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "ZED_TERM",
    };
    expect(getIDECliBinary(ide)).toBe("zed");
  });

  it("returns null for JetBrains", () => {
    const ide: IDEDetection = {
      type: "jetbrains",
      name: "WebStorm",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: false,
      detectionSource: "JETBRAINS_IDE",
    };
    expect(getIDECliBinary(ide)).toBeNull();
  });

  it("returns null for terminal", () => {
    const ide: IDEDetection = {
      type: "terminal",
      name: "iTerm.app",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: "TERM_PROGRAM",
    };
    expect(getIDECliBinary(ide)).toBeNull();
  });

  it("returns null for unknown", () => {
    const ide: IDEDetection = {
      type: "unknown",
      name: "Unknown",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: "none",
    };
    expect(getIDECliBinary(ide)).toBeNull();
  });
});

describe("isInIDETerminal", () => {
  beforeEach(() => {
    delete process.env.VSCODE_PID;
    delete process.env.VSCODE_CWD;
    delete process.env.TERM_PROGRAM;
    delete process.env.TERM;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.CURSOR_SHELL_VERSION;
    delete process.env.WINDSURF_PARENT_PROCESS;
    delete process.env.WINDSURF_EDITOR;
    delete process.env.TERMINAL_EMULATOR;
    delete process.env.JETBRAINS_IDE;
    delete process.env.ZED_TERM;
    delete process.env.TMUX;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("returns true when in VS Code terminal with TERM set", () => {
    process.env.VSCODE_PID = "12345";
    process.env.TERM = "xterm-256color";
    expect(isInIDETerminal()).toBe(true);
  });

  it("returns true when in Cursor terminal with TERM set", () => {
    process.env.CURSOR_TRACE_ID = "abc-123";
    process.env.TERM = "xterm-256color";
    expect(isInIDETerminal()).toBe(true);
  });

  it("returns false when in VS Code but no TERM set", () => {
    process.env.VSCODE_PID = "12345";
    // No TERM set
    expect(isInIDETerminal()).toBe(false);
  });

  it("returns false when in standalone terminal", () => {
    process.env.TERM_PROGRAM = "iTerm.app";
    process.env.TERM = "xterm-256color";
    expect(isInIDETerminal()).toBe(false);
  });

  it("returns false when no IDE detected", () => {
    // No env vars set
    expect(isInIDETerminal()).toBe(false);
  });
});

describe("generateEnvironmentRecommendations", () => {
  it("generates recommendations for IDE with integrated terminal", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const recommendations = generateEnvironmentRecommendations(ide);
    
    expect(recommendations.length).toBe(5);
    
    // First recommendation should be IDE-specific with high priority
    expect(recommendations[0].option).toContain("Visual Studio Code");
    expect(recommendations[0].priority).toBe("high");
    expect(recommendations[0].mode).toBe("ide");
    
    // Should have terminal, pty, background, and stay options
    expect(recommendations.map(r => r.mode)).toContain("terminal");
    expect(recommendations.map(r => r.mode)).toContain("pty");
    expect(recommendations.map(r => r.mode)).toContain("background");
    expect(recommendations.map(r => r.mode)).toContain("stay");
  });

  it("generates recommendations without IDE option for terminal-only", () => {
    const ide: IDEDetection = {
      type: "terminal",
      name: "iTerm.app",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: "TERM_PROGRAM",
    };
    const recommendations = generateEnvironmentRecommendations(ide);
    
    // First recommendation should NOT be IDE-specific
    expect(recommendations[0].option).not.toContain("iTerm.app");
    expect(recommendations[0].mode).toBe("terminal");
    
    // Should not have IDE mode
    expect(recommendations.map(r => r.mode)).not.toContain("ide");
  });

  it("generates recommendations for JetBrains (has terminal but no CLI open)", () => {
    const ide: IDEDetection = {
      type: "jetbrains",
      name: "WebStorm",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: false,
      detectionSource: "JETBRAINS_IDE",
    };
    const recommendations = generateEnvironmentRecommendations(ide);
    
    // JetBrains has integrated terminal so should offer IDE option
    expect(recommendations[0].option).toContain("WebStorm");
    expect(recommendations[0].mode).toBe("ide");
  });

  it("all recommendations have required fields", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const recommendations = generateEnvironmentRecommendations(ide);
    
    for (const rec of recommendations) {
      expect(rec.option).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(rec.priority);
      expect(rec.reason).toBeTruthy();
    }
  });

  it("terminal option has medium priority", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const recommendations = generateEnvironmentRecommendations(ide);
    
    const terminalRec = recommendations.find(r => r.mode === "terminal");
    expect(terminalRec?.priority).toBe("medium");
  });

  it("background and stay options have low priority", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const recommendations = generateEnvironmentRecommendations(ide);
    
    const backgroundRec = recommendations.find(r => r.mode === "background");
    const stayRec = recommendations.find(r => r.mode === "stay");
    
    expect(backgroundRec?.priority).toBe("low");
    expect(stayRec?.priority).toBe("low");
  });
});

describe("formatEnvironmentReport", () => {
  it("formats a complete report for VS Code", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      version: "1.85.0",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const report = formatEnvironmentReport(ide, "iTerm.app");
    
    expect(report).toContain("## Environment Detection");
    expect(report).toContain("**IDE/Editor:** Visual Studio Code");
    expect(report).toContain("**Detection Method:** VSCODE_PID");
    expect(report).toContain("**Terminal:** iTerm.app");
    expect(report).toContain("**Platform:**");
    expect(report).toContain("**Version:** 1.85.0");
    expect(report).toContain("### Capabilities");
    expect(report).toContain("✓ Has integrated terminal");
    expect(report).toContain("✓ Can open new window via CLI");
    expect(report).toContain("### Recommended Launch Options");
  });

  it("formats report without version when not available", () => {
    const ide: IDEDetection = {
      type: "cursor",
      name: "Cursor",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "CURSOR_TRACE_ID",
    };
    const report = formatEnvironmentReport(ide, "Terminal");
    
    expect(report).toContain("**IDE/Editor:** Cursor");
    expect(report).not.toContain("**Version:**");
  });

  it("shows negative capability indicators for terminal-only", () => {
    const ide: IDEDetection = {
      type: "terminal",
      name: "iTerm.app",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: "TERM_PROGRAM",
    };
    const report = formatEnvironmentReport(ide, "iTerm.app");
    
    expect(report).toContain("✗ No integrated terminal");
    expect(report).toContain("✓ Can open new window via CLI");
  });

  it("shows negative CLI indicator for JetBrains", () => {
    const ide: IDEDetection = {
      type: "jetbrains",
      name: "WebStorm",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: false,
      detectionSource: "JETBRAINS_IDE",
    };
    const report = formatEnvironmentReport(ide, "JetBrains");
    
    expect(report).toContain("✓ Has integrated terminal");
    expect(report).toContain("✗ Cannot open new window via CLI");
  });

  it("includes all recommendations in the report", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const report = formatEnvironmentReport(ide, "Terminal");
    
    expect(report).toContain("Open in Visual Studio Code");
    expect(report).toContain("Open in new terminal tab");
    expect(report).toContain("Open in-app PTY");
    expect(report).toContain("Run in background");
    expect(report).toContain("Stay in current session");
  });

  it("formats unknown environment", () => {
    const ide: IDEDetection = {
      type: "unknown",
      name: "Unknown",
      hasIntegratedTerminal: false,
      canOpenInTerminal: false,
      canOpenInWindow: true,
      detectionSource: "none",
    };
    const report = formatEnvironmentReport(ide, "Unknown");
    
    expect(report).toContain("**IDE/Editor:** Unknown");
    expect(report).toContain("**Detection Method:** none");
    expect(report).toContain("✗ No integrated terminal");
    expect(report).toContain("✓ Can open new window via CLI");
  });

  it("shows CLI available status when cliAvailable is true", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      cliAvailable: true,
      cliBinary: "code",
      detectionSource: "VSCODE_PID",
    };
    const report = formatEnvironmentReport(ide, "Terminal");

    expect(report).toContain("✓ Can open new window via CLI (`code` available)");
  });

  it("shows CLI unavailable warning when cliAvailable is false", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      cliAvailable: false,
      cliBinary: "code",
      cliInstallHint: "Cmd+Shift+P → 'Shell Command: Install code command in PATH'",
      detectionSource: "VSCODE_PID",
    };
    const report = formatEnvironmentReport(ide, "Terminal");

    expect(report).toContain("⚠ Can open new window via CLI — but `code` NOT found in PATH");
    expect(report).toContain("Cmd+Shift+P");
  });
});

describe("getInstallHint", () => {
  it("returns VS Code install hint", () => {
    const hint = getInstallHint("vscode", "code");
    expect(hint).toContain("Shell Command: Install code command in PATH");
  });

  it("returns Cursor install hint", () => {
    const hint = getInstallHint("cursor", "cursor");
    expect(hint).toContain("Shell Command: Install cursor command in PATH");
  });

  it("returns Windsurf install hint", () => {
    const hint = getInstallHint("windsurf", "windsurf");
    expect(hint).toContain("windsurf");
    expect(hint).toContain("PATH");
  });

  it("returns Zed install hint", () => {
    const hint = getInstallHint("zed", "zed");
    expect(hint).toContain("zed");
    expect(hint).toContain("PATH");
  });

  it("returns generic hint for unknown IDE type", () => {
    const hint = getInstallHint("terminal" as IDEType, "mybinary");
    expect(hint).toContain("mybinary");
    expect(hint).toContain("PATH");
  });
});

describe("detectIDEWithCLICheck", () => {
  beforeEach(() => {
    delete process.env.VSCODE_PID;
    delete process.env.VSCODE_CWD;
    delete process.env.VSCODE_VERSION;
    delete process.env.TERM_PROGRAM;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.CURSOR_SHELL_VERSION;
    delete process.env.WINDSURF_PARENT_PROCESS;
    delete process.env.WINDSURF_EDITOR;
    delete process.env.TERMINAL_EMULATOR;
    delete process.env.JETBRAINS_IDE;
    delete process.env.JETBRAINS_IDE_NAME;
    delete process.env.ZED_TERM;
    delete process.env.TERM;
    delete process.env.TMUX;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("sets cliAvailable=true when VS Code CLI is in PATH", async () => {
    process.env.VSCODE_PID = "12345";
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/code");

    const result = await detectIDEWithCLICheck();

    expect(result.type).toBe("vscode");
    expect(result.cliAvailable).toBe(true);
    expect(result.cliBinary).toBe("code");
    expect(result.cliInstallHint).toBeUndefined();
    expect(shell.which).toHaveBeenCalledWith("code");
  });

  it("sets cliAvailable=false with install hint when VS Code CLI is missing", async () => {
    process.env.VSCODE_PID = "12345";
    vi.mocked(shell.which).mockResolvedValueOnce(null);

    const result = await detectIDEWithCLICheck();

    expect(result.type).toBe("vscode");
    expect(result.cliAvailable).toBe(false);
    expect(result.cliBinary).toBe("code");
    expect(result.cliInstallHint).toContain("Shell Command: Install code command in PATH");
  });

  it("sets cliAvailable=true when Cursor CLI is in PATH", async () => {
    process.env.CURSOR_TRACE_ID = "abc-123";
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/cursor");

    const result = await detectIDEWithCLICheck();

    expect(result.type).toBe("cursor");
    expect(result.cliAvailable).toBe(true);
    expect(result.cliBinary).toBe("cursor");
  });

  it("sets cliAvailable=false for terminal-only (no CLI binary)", async () => {
    process.env.TERM_PROGRAM = "iTerm.app";

    const result = await detectIDEWithCLICheck();

    expect(result.type).toBe("terminal");
    expect(result.cliAvailable).toBe(false);
    expect(result.cliBinary).toBeUndefined();
    expect(shell.which).not.toHaveBeenCalled();
  });

  it("sets cliAvailable=false for unknown environment", async () => {
    const result = await detectIDEWithCLICheck();

    expect(result.type).toBe("unknown");
    expect(result.cliAvailable).toBe(false);
    expect(shell.which).not.toHaveBeenCalled();
  });

  it("checks 'zed' binary for Zed editor", async () => {
    process.env.ZED_TERM = "1";
    vi.mocked(shell.which).mockResolvedValueOnce("/usr/local/bin/zed");

    const result = await detectIDEWithCLICheck();

    expect(result.type).toBe("zed");
    expect(result.cliAvailable).toBe(true);
    expect(result.cliBinary).toBe("zed");
    expect(shell.which).toHaveBeenCalledWith("zed");
  });

  it("checks 'windsurf' binary for Windsurf editor", async () => {
    process.env.WINDSURF_EDITOR = "1";
    vi.mocked(shell.which).mockResolvedValueOnce(null);

    const result = await detectIDEWithCLICheck();

    expect(result.type).toBe("windsurf");
    expect(result.cliAvailable).toBe(false);
    expect(result.cliBinary).toBe("windsurf");
    expect(result.cliInstallHint).toContain("windsurf");
  });
});

describe("generateEnvironmentRecommendations — CLI availability", () => {
  it("demotes IDE option when cliAvailable is false", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      cliAvailable: false,
      cliBinary: "code",
      cliInstallHint: "Install code CLI",
      detectionSource: "VSCODE_PID",
    };
    const recommendations = generateEnvironmentRecommendations(ide);

    // IDE option should exist but be low priority with "(CLI not installed)"
    const ideRec = recommendations.find(r => r.mode === "ide");
    expect(ideRec).toBeDefined();
    expect(ideRec!.priority).toBe("low");
    expect(ideRec!.option).toContain("CLI not installed");

    // Terminal should be promoted to high priority
    const terminalRec = recommendations.find(r => r.mode === "terminal");
    expect(terminalRec!.priority).toBe("high");
  });

  it("keeps IDE option as high priority when cliAvailable is true", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      cliAvailable: true,
      cliBinary: "code",
      detectionSource: "VSCODE_PID",
    };
    const recommendations = generateEnvironmentRecommendations(ide);

    const ideRec = recommendations.find(r => r.mode === "ide");
    expect(ideRec).toBeDefined();
    expect(ideRec!.priority).toBe("high");
    expect(ideRec!.option).toContain("Recommended");

    // Terminal should be medium priority (not promoted)
    const terminalRec = recommendations.find(r => r.mode === "terminal");
    expect(terminalRec!.priority).toBe("medium");
  });

  it("keeps IDE option when cliAvailable is undefined (not checked)", () => {
    const ide: IDEDetection = {
      type: "vscode",
      name: "Visual Studio Code",
      hasIntegratedTerminal: true,
      canOpenInTerminal: true,
      canOpenInWindow: true,
      detectionSource: "VSCODE_PID",
    };
    const recommendations = generateEnvironmentRecommendations(ide);

    const ideRec = recommendations.find(r => r.mode === "ide");
    expect(ideRec).toBeDefined();
    expect(ideRec!.priority).toBe("high");
  });
});
