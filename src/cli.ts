#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import prompts from "prompts";
import {
  PRIMARY_AGENTS,
  SUBAGENTS,
  ALL_AGENTS,
  getPrimaryChoices,
  getSubagentChoices,
} from "./registry.js";

const VERSION = "2.0.0";
const PLUGIN_NAME = "cortex-agents";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The .opencode directory shipped with the package (adjacent to dist/)
const PACKAGE_OPENCODE_DIR = path.resolve(__dirname, "..", ".opencode");

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentConfig {
  model?: string;
  [key: string]: unknown;
}

interface OpencodeConfig {
  $schema?: string;
  plugin?: string[];
  agent?: { [key: string]: AgentConfig | undefined };
  [key: string]: unknown;
}

// ─── Config Helpers ──────────────────────────────────────────────────────────

function getGlobalDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homeDir, ".config", "opencode");
}

function findOpencodeConfig(): { path: string; isGlobal: boolean } | null {
  const localPath = path.join(process.cwd(), "opencode.json");
  if (fs.existsSync(localPath)) {
    return { path: localPath, isGlobal: false };
  }
  const globalPath = path.join(getGlobalDir(), "opencode.json");
  if (fs.existsSync(globalPath)) {
    return { path: globalPath, isGlobal: true };
  }
  return null;
}

function readConfig(configPath: string): OpencodeConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(configPath: string, config: OpencodeConfig): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

// ─── File Copy Helpers ───────────────────────────────────────────────────────

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function installAgentsAndSkills(targetDir: string): void {
  if (!fs.existsSync(PACKAGE_OPENCODE_DIR)) {
    console.log(
      "  Warning: Package .opencode directory not found, skipping agents/skills copy."
    );
    return;
  }

  const agentsSrc = path.join(PACKAGE_OPENCODE_DIR, "agents");
  const skillsSrc = path.join(PACKAGE_OPENCODE_DIR, "skills");

  // Copy agents
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(targetDir, "agents");
    copyDirRecursive(agentsSrc, agentsDest);
    const count = fs
      .readdirSync(agentsSrc)
      .filter((f) => f.endsWith(".md")).length;
    console.log(`  Installed ${count} agents -> ${agentsDest}`);
  }

  // Copy skills
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(targetDir, "skills");
    copyDirRecursive(skillsSrc, skillsDest);
    const count = fs
      .readdirSync(skillsSrc)
      .filter((f) => !f.startsWith(".")).length;
    console.log(`  Installed ${count} skills -> ${skillsDest}`);
  }
}

function removeAgentsAndSkills(targetDir: string): void {
  const agentsSrc = path.join(PACKAGE_OPENCODE_DIR, "agents");
  const skillsSrc = path.join(PACKAGE_OPENCODE_DIR, "skills");

  // Remove only agent files that we installed
  if (fs.existsSync(agentsSrc)) {
    for (const file of fs.readdirSync(agentsSrc)) {
      const dest = path.join(targetDir, "agents", file);
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
        console.log(`  Removed agent: ${file}`);
      }
    }
  }

  // Remove only skill dirs that we installed
  if (fs.existsSync(skillsSrc)) {
    for (const dir of fs.readdirSync(skillsSrc)) {
      const dest = path.join(targetDir, "skills", dir);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true });
        console.log(`  Removed skill: ${dir}`);
      }
    }
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

function install(): void {
  console.log(`\nInstalling ${PLUGIN_NAME} v${VERSION}...\n`);

  const globalDir = getGlobalDir();
  const configInfo = findOpencodeConfig();

  if (!configInfo) {
    // Create global config
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    const globalPath = path.join(globalDir, "opencode.json");
    const newConfig: OpencodeConfig = {
      $schema: "https://opencode.ai/config.json",
      plugin: [PLUGIN_NAME],
    };
    writeConfig(globalPath, newConfig);
    console.log(`Created config: ${globalPath}`);
    console.log(`Added plugin: ${PLUGIN_NAME}\n`);
  } else {
    const config = readConfig(configInfo.path);
    if (!config.plugin) config.plugin = [];
    if (!config.plugin.includes(PLUGIN_NAME)) {
      config.plugin.push(PLUGIN_NAME);
      writeConfig(configInfo.path, config);
      console.log(`Added plugin to config: ${configInfo.path}\n`);
    } else {
      console.log(`Plugin already in config: ${configInfo.path}\n`);
    }
  }

  // Copy agents and skills into the global opencode config dir
  console.log("Installing agents and skills...");
  installAgentsAndSkills(globalDir);

  console.log("\nDone! Next steps:");
  console.log(`  1. Run 'npx ${PLUGIN_NAME} configure' to select your models`);
  console.log("  2. Restart OpenCode to load the plugin\n");
}

function uninstall(): void {
  console.log(`\nUninstalling ${PLUGIN_NAME}...\n`);

  const configInfo = findOpencodeConfig();
  if (!configInfo) {
    console.log("No OpenCode config found. Nothing to uninstall.");
    return;
  }

  const config = readConfig(configInfo.path);

  // Remove plugin entry
  if (config.plugin?.includes(PLUGIN_NAME)) {
    config.plugin = config.plugin.filter((p) => p !== PLUGIN_NAME);
    console.log(`Removed plugin from config: ${configInfo.path}\n`);
  }

  // Remove agent model configs that we set
  if (config.agent) {
    for (const name of ALL_AGENTS) {
      if (config.agent[name]) {
        delete config.agent[name]!.model;
        // Clean up empty agent entries
        if (Object.keys(config.agent[name]!).length === 0) {
          delete config.agent[name];
        }
      }
    }
    // Clean up empty agent object
    if (Object.keys(config.agent).length === 0) {
      delete config.agent;
    }
  }

  writeConfig(configInfo.path, config);

  // Remove agents and skills
  const globalDir = getGlobalDir();
  console.log("Removing agents and skills...");
  removeAgentsAndSkills(globalDir);

  console.log("\nDone! Restart OpenCode to apply changes.\n");
}

async function configure(): Promise<void> {
  const args = process.argv.slice(3);
  const isReset = args.includes("--reset");

  // Handle --reset flag
  if (isReset) {
    return configureReset();
  }

  console.log(`\n🔧 Cortex Agents — Model Configuration\n`);

  // Ensure plugin is installed first
  const configInfo = findOpencodeConfig();
  const config = configInfo
    ? readConfig(configInfo.path)
    : { $schema: "https://opencode.ai/config.json" as const };

  if (!config.plugin?.includes(PLUGIN_NAME)) {
    console.log(
      `⚠  Plugin not installed. Adding '${PLUGIN_NAME}' to config first.\n`
    );
    if (!config.plugin) config.plugin = [];
    config.plugin.push(PLUGIN_NAME);
  }

  // ── Primary model selection ────────────────────────────────
  const primaryChoices = getPrimaryChoices();
  primaryChoices.push({
    title: "Enter custom model ID",
    description: "provider/model format",
    value: "__custom__",
  });

  console.log(
    "Primary agents (build, plan, debug) handle complex tasks.\nUse your best available model.\n"
  );

  const { primaryModel } = await prompts({
    type: "select",
    name: "primaryModel",
    message: "Select model for PRIMARY agents:",
    choices: primaryChoices,
    hint: "Use arrow keys, Enter to confirm",
  });

  // User cancelled (Ctrl+C)
  if (primaryModel === undefined) {
    console.log("\nConfiguration cancelled.\n");
    process.exit(0);
  }

  let primary: string = primaryModel;
  if (primary === "__custom__") {
    const { custom } = await prompts({
      type: "text",
      name: "custom",
      message: "Enter model ID (provider/model):",
      validate: (v: string) =>
        v.includes("/") ? true : "Format: provider/model-name",
    });
    if (!custom) {
      console.log("\nConfiguration cancelled.\n");
      process.exit(0);
    }
    primary = custom;
  }

  console.log(`\n✓ Primary model: ${primary}\n`);

  // ── Subagent model selection ───────────────────────────────
  const subagentChoices = getSubagentChoices(primary);
  subagentChoices.push({
    title: "Enter custom model ID",
    description: "provider/model format",
    value: "__custom__",
  });

  console.log(
    "Subagents (fullstack, testing, security, devops) handle focused tasks.\nA faster/cheaper model works great here.\n"
  );

  const { subagentModel } = await prompts({
    type: "select",
    name: "subagentModel",
    message: "Select model for SUBAGENTS:",
    choices: subagentChoices,
    hint: "Use arrow keys, Enter to confirm",
  });

  if (subagentModel === undefined) {
    console.log("\nConfiguration cancelled.\n");
    process.exit(0);
  }

  let subagent: string = subagentModel === "__same__" ? primary : subagentModel;
  if (subagent === "__custom__") {
    const { custom } = await prompts({
      type: "text",
      name: "custom",
      message: "Enter model ID (provider/model):",
      validate: (v: string) =>
        v.includes("/") ? true : "Format: provider/model-name",
    });
    if (!custom) {
      console.log("\nConfiguration cancelled.\n");
      process.exit(0);
    }
    subagent = custom;
  }

  console.log(`✓ Subagent model: ${subagent}\n`);

  // ── Write to opencode.json ─────────────────────────────────
  if (!config.agent) config.agent = {};

  for (const name of PRIMARY_AGENTS) {
    if (!config.agent[name]) config.agent[name] = {};
    config.agent[name]!.model = primary;
  }

  for (const name of SUBAGENTS) {
    if (!config.agent[name]) config.agent[name] = {};
    config.agent[name]!.model = subagent;
  }

  const targetPath =
    configInfo?.path || path.join(getGlobalDir(), "opencode.json");
  writeConfig(targetPath, config);

  // ── Print summary ──────────────────────────────────────────
  console.log("━".repeat(50));
  console.log(`✓ Configuration saved to ${targetPath}\n`);

  console.log("  Primary agents:");
  for (const name of PRIMARY_AGENTS) {
    console.log(`    ${name.padEnd(10)} → ${primary}`);
  }

  console.log("\n  Subagents:");
  for (const name of SUBAGENTS) {
    console.log(`    ${name.padEnd(10)} → ${subagent}`);
  }

  console.log("\nRestart OpenCode to apply changes.\n");
}

function configureReset(): void {
  console.log(`\n🔧 Cortex Agents — Reset Model Configuration\n`);

  const configInfo = findOpencodeConfig();
  if (!configInfo) {
    console.log("No OpenCode config found. Nothing to reset.\n");
    return;
  }

  const config = readConfig(configInfo.path);
  if (!config.agent) {
    console.log("No agent configuration found. Nothing to reset.\n");
    return;
  }

  let resetCount = 0;
  for (const name of ALL_AGENTS) {
    if (config.agent[name]?.model) {
      delete config.agent[name]!.model;
      resetCount++;
      // Clean up empty agent entries
      if (Object.keys(config.agent[name]!).length === 0) {
        delete config.agent[name];
      }
    }
  }

  // Clean up empty agent object
  if (Object.keys(config.agent).length === 0) {
    delete config.agent;
  }

  if (resetCount === 0) {
    console.log("No model configuration found for cortex agents. Nothing to reset.\n");
    return;
  }

  writeConfig(configInfo.path, config);

  console.log(`✓ Reset ${resetCount} agent model configurations.`);
  console.log(`  Config: ${configInfo.path}`);
  console.log("\nAgents will now use OpenCode's default model.");
  console.log("Restart OpenCode to apply changes.\n");
  console.log(
    `Run 'npx ${PLUGIN_NAME} configure' to select new models.\n`
  );
}

function status(): void {
  console.log(`\n${PLUGIN_NAME} v${VERSION}\n`);

  const configInfo = findOpencodeConfig();
  if (!configInfo) {
    console.log("Status: NOT INSTALLED");
    console.log(`\nRun 'npx ${PLUGIN_NAME} install' to set up.\n`);
    return;
  }

  const config = readConfig(configInfo.path);
  const isInstalled = config.plugin?.includes(PLUGIN_NAME);

  console.log(`Status: ${isInstalled ? "INSTALLED" : "NOT INSTALLED"}`);
  console.log(
    `Config: ${configInfo.path} (${configInfo.isGlobal ? "global" : "local"})`
  );

  // Check agents
  const globalDir = getGlobalDir();
  const agentsDir = path.join(globalDir, "agents");
  const skillsDir = path.join(globalDir, "skills");
  const agentCount = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md")).length
    : 0;
  const skillCount = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir).filter((f) => !f.startsWith(".")).length
    : 0;

  console.log(`\nAgents installed: ${agentCount}`);
  console.log(`Skills installed: ${skillCount}`);

  // Show model configuration
  if (config.agent) {
    const primaryModels = PRIMARY_AGENTS.map(
      (n) => config.agent?.[n]?.model
    ).filter(Boolean);
    const subagentModels = SUBAGENTS.map(
      (n) => config.agent?.[n]?.model
    ).filter(Boolean);

    if (primaryModels.length > 0 || subagentModels.length > 0) {
      console.log("\nModel Configuration:");

      if (primaryModels.length > 0) {
        const unique = [...new Set(primaryModels)];
        console.log(
          `  Primary agents:  ${unique.join(", ")}`
        );
      }

      if (subagentModels.length > 0) {
        const unique = [...new Set(subagentModels)];
        console.log(
          `  Subagents:       ${unique.join(", ")}`
        );
      }
    } else {
      console.log("\nModels: Not configured (using OpenCode defaults)");
      console.log(
        `  Run 'npx ${PLUGIN_NAME} configure' to select models.`
      );
    }
  } else {
    console.log("\nModels: Not configured (using OpenCode defaults)");
    console.log(
      `  Run 'npx ${PLUGIN_NAME} configure' to select models.`
    );
  }

  if (!isInstalled) {
    console.log(`\nRun 'npx ${PLUGIN_NAME} install' to add to config.`);
  }
  console.log();
}

function help(): void {
  console.log(`${PLUGIN_NAME} v${VERSION}

Cortex agents for OpenCode — worktree workflow, plan persistence, and session management.

USAGE:
  npx ${PLUGIN_NAME} <command> [options]

COMMANDS:
  install              Install plugin, agents, and skills into OpenCode config
  configure            Interactive model selection for all agents
  configure --reset    Reset model configuration to OpenCode defaults
  uninstall            Remove plugin, agents, skills, and model config
  status               Show installation and model configuration status
  help                 Show this help message

EXAMPLES:
  npx ${PLUGIN_NAME} install           # Install plugin
  npx ${PLUGIN_NAME} configure         # Select models interactively
  npx ${PLUGIN_NAME} configure --reset # Reset to default models
  npx ${PLUGIN_NAME} status            # Check status

AGENT TIERS:
  Primary agents (build, plan, debug):
    Handle complex tasks — select your best model.

  Subagents (fullstack, testing, security, devops):
    Handle focused tasks — a fast/cheap model works great.

INCLUDED TOOLS:
  cortex_init, cortex_status    - .cortex directory management
  worktree_create, worktree_list, worktree_remove, worktree_open
  branch_create, branch_status, branch_switch
  plan_save, plan_list, plan_load, plan_delete
  session_save, session_list, session_load

INCLUDED SKILLS:
  web-development, testing-strategies, security-hardening,
  deployment-automation, code-quality, git-workflow
`);
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

const command = process.argv[2] || "help";

switch (command) {
  case "install":
    install();
    break;
  case "configure":
    configure().catch((err) => {
      console.error("Configuration failed:", err.message);
      process.exit(1);
    });
    break;
  case "uninstall":
    uninstall();
    break;
  case "status":
    status();
    break;
  case "help":
  case "--help":
  case "-h":
    help();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error(`Run 'npx ${PLUGIN_NAME} help' for usage.`);
    process.exit(1);
}
