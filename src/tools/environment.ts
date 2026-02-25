/**
 * Environment Detection Tool
 *
 * Provides agents with information about the current development environment
 * (IDE, terminal, editor) to offer contextually appropriate worktree launch options.
 */

import { tool } from "@opencode-ai/plugin";
import { detectIDEWithCLICheck, formatEnvironmentReport, generateEnvironmentRecommendations } from "../utils/ide.js";
import { detectDriver } from "../utils/terminal.js";

export const detectEnvironment = tool({
  description:
    "Detect the current development environment (IDE, terminal, editor) " +
    "to offer contextually appropriate worktree launch options. " +
    "Returns environment info and recommended launch options.",
  args: {},
  async execute(args, context) {
    // Use async detection that verifies CLI availability in PATH
    const ide = await detectIDEWithCLICheck();
    const terminal = detectDriver();

    // Format the report (now includes CLI availability status)
    const report = formatEnvironmentReport(ide, terminal.name);

    // Add CLI status section
    const additionalInfo: string[] = [];
    additionalInfo.push(``, `### CLI Status`, ``);
    additionalInfo.push(`- IDE: ${ide.name}`);
    additionalInfo.push(`- Terminal: ${terminal.name}`);
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
    const terminal = detectDriver();

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
        name: terminal.name,
      },
      platform: process.platform,
      recommendations: generateEnvironmentRecommendations(ide),
    }, null, 2);
  },
});
