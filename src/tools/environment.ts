/**
 * Environment Detection Tool
 *
 * Provides agents with information about the current development environment
 * (IDE, terminal, editor) to offer contextually appropriate worktree launch options.
 *
 * Uses two detection systems:
 *   - IDE detection (ide.ts) — for "Open in IDE" options
 *   - Terminal detection (terminal.ts) — for "Open in terminal tab" options
 *
 * The terminal detection uses a multi-strategy chain:
 *   1. Environment variables (fast, synchronous)
 *   2. Process-tree walk (finds terminal in parent processes)
 *   3. Frontmost app detection (macOS only)
 *   4. User preference (.cortex/config.json)
 */

import { tool } from "@opencode-ai/plugin";
import { detectIDEWithCLICheck, formatEnvironmentReport, generateEnvironmentRecommendations } from "../utils/ide.js";
import { detectDriver, detectTerminalDriver } from "../utils/terminal.js";

export const detectEnvironment = tool({
  description:
    "Detect the current development environment (IDE, terminal, editor) " +
    "to offer contextually appropriate worktree launch options. " +
    "Returns environment info and recommended launch options.",
  args: {},
  async execute(args, context) {
    // Use async detection that verifies CLI availability in PATH
    const ide = await detectIDEWithCLICheck();
    const ideDriver = detectDriver();

    // Multi-strategy terminal detection (the one used for "Open in terminal tab")
    const terminalDetection = await detectTerminalDriver(context.worktree);

    // Format the report (now includes CLI availability status)
    const report = formatEnvironmentReport(ide, terminalDetection.driver.name);

    // Add CLI status section
    const additionalInfo: string[] = [];
    additionalInfo.push(``, `### CLI Status`, ``);
    additionalInfo.push(`- IDE: ${ide.name}`);
    additionalInfo.push(`- IDE Driver: ${ideDriver.name}`);
    additionalInfo.push(`- Terminal Emulator: **${terminalDetection.driver.name}**`);
    additionalInfo.push(`- Platform: ${process.platform}`);

    if (ide.cliBinary) {
      if (ide.cliAvailable) {
        additionalInfo.push(`- CLI: \`${ide.cliBinary}\` available in PATH`);
      } else {
        additionalInfo.push(`- CLI: \`${ide.cliBinary}\` **NOT found** in PATH`);
        if (ide.cliInstallHint) {
          additionalInfo.push(`- Fix: ${ide.cliInstallHint}`);
        }
      }
    }

    // Terminal detection details
    additionalInfo.push(``, `### Terminal Detection`, ``);
    additionalInfo.push(`- Strategy: **${terminalDetection.strategy}**`);
    if (terminalDetection.detail) {
      additionalInfo.push(`- Detail: ${terminalDetection.detail}`);
    }
    additionalInfo.push(`- Driver: ${terminalDetection.driver.name}`);
    additionalInfo.push(``);
    additionalInfo.push(`When "Open in terminal tab" is selected, a new tab will open in **${terminalDetection.driver.name}**.`);

    return report + additionalInfo.join("\n");
  },
});

/**
 * Quick environment check tool for agents.
 * Returns a simplified response for quick decision-making.
 */
export const getEnvironmentInfo = tool({
  description:
    "Get quick environment info for deciding worktree launch options. " +
    "Returns IDE type, terminal name, and whether to offer IDE-specific options.",
  args: {},
  async execute(args, context) {
    const ide = await detectIDEWithCLICheck();
    const terminalDetection = await detectTerminalDriver(context.worktree);

    return JSON.stringify({
      ide: {
        type: ide.type,
        name: ide.name,
        hasIntegratedTerminal: ide.hasIntegratedTerminal,
        canOpenInWindow: ide.canOpenInWindow,
        cliAvailable: ide.cliAvailable,
        cliBinary: ide.cliBinary,
        cliInstallHint: ide.cliInstallHint,
      },
      terminal: {
        name: terminalDetection.driver.name,
        detectionStrategy: terminalDetection.strategy,
        detectionDetail: terminalDetection.detail,
      },
      platform: process.platform,
      recommendations: generateEnvironmentRecommendations(ide),
    }, null, 2);
  },
});
