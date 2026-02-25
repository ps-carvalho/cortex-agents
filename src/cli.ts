#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import prompts from "prompts";
import {
  PRIMARY_AGENTS,
  SUBAGENTS,
  ALL_AGENTS,
  DISABLED_BUILTIN_AGENTS,
  STALE_AGENT_FILES,
  getPrimaryChoices,
  getSubagentChoices,
} from "./registry.js";

const VERSION = "3.4.0";
const PLUGIN_NAME = "cortex-agents";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The .opencode directory shipped with the package (adjacent to dist/)
const PACKAGE_OPENCODE_DIR = path.resolve(__dirname, "..", ".opencode");

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentConfig {
  model?: string;
  disable?: boolean;
  [key: string]: unknown;
}

interface OpencodeConfig {
  $schema?: string;
  plugin?: string[];
  agent?: { [key: string]: AgentConfig | undefined };
  default_agent?: string;
  defaultAgent?: string; // legacy — cleaned up on write
  [key: string]: unknown;
}

/** Per-project model config stored in .opencode/models.json */
interface ProjectModelsConfig {
  primary: { model: string };
  subagent: { model: string };
  agents: { [key: string]: { model: string } };
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

// ─── Per-Project Model Config (.opencode/models.json) ───────────────────────

const PROJECT_MODELS_FILE = "models.json";

function getProjectModelsPath(): string {
  return path.join(process.cwd(), ".opencode", PROJECT_MODELS_FILE);
}

function hasProjectModelsConfig(): boolean {
  return fs.existsSync(getProjectModelsPath());
}

function readProjectModels(): ProjectModelsConfig | null {
  const modelsPath = getProjectModelsPath();
  if (!fs.existsSync(modelsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(modelsPath, "utf-8"));
  } catch {
    return null;
  }
}

function writeProjectModels(primary: string, subagent: string): void {
  const modelsPath = getProjectModelsPath();
  const dir = path.dirname(modelsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const config: ProjectModelsConfig = {
    primary: { model: primary },
    subagent: { model: subagent },
    agents: {},
  };

  for (const name of PRIMARY_AGENTS) {
    config.agents[name] = { model: primary };
  }
  for (const name of SUBAGENTS) {
    config.agents[name] = { model: subagent };
  }

  fs.writeFileSync(modelsPath, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Sync .opencode/models.json → local opencode.json agent model settings.
 * Creates or merges into local opencode.json at project root.
 */
function syncProjectModelsToConfig(): boolean {
  const models = readProjectModels();
  if (!models) return false;

  const localPath = path.join(process.cwd(), "opencode.json");
  const config: OpencodeConfig = fs.existsSync(localPath)
    ? readConfig(localPath)
    : { $schema: "https://opencode.ai/config.json" };

  if (!config.agent) config.agent = {};

  for (const [name, entry] of Object.entries(models.agents)) {
    if (!config.agent[name]) config.agent[name] = {};
    config.agent[name]!.model = entry.model;
  }

  writeConfig(localPath, config);
  return true;
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

function cleanupStaleAgents(globalDir: string): void {
  const agentsDir = path.join(globalDir, "agents");
  if (!fs.existsSync(agentsDir)) return;
  for (const file of STALE_AGENT_FILES) {
    const filePath = path.join(agentsDir, file);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`  Cleaned up stale agent: ${file}`);
      }
    } catch (err) {
      console.warn(
        `  Warning: Could not remove stale agent ${file}: ${(err as Error).message}`
      );
    }
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
    const disabledAgents: { [key: string]: AgentConfig } = {};
    for (const name of DISABLED_BUILTIN_AGENTS) {
      disabledAgents[name] = { disable: true };
    }
    const newConfig: OpencodeConfig = {
      $schema: "https://opencode.ai/config.json",
      plugin: [PLUGIN_NAME],
      default_agent: "architect",
      agent: disabledAgents,
    };
    writeConfig(globalPath, newConfig);
    console.log(`Created config: ${globalPath}`);
    console.log(`Added plugin: ${PLUGIN_NAME}\n`);
  } else {
    const config = readConfig(configInfo.path);
    if (!config.plugin) config.plugin = [];
    if (!config.plugin.includes(PLUGIN_NAME)) {
      config.plugin.push(PLUGIN_NAME);
    }

    // Disable built-in agents that cortex-agents replaces
    if (!config.agent) config.agent = {};
    for (const name of DISABLED_BUILTIN_AGENTS) {
      if (!config.agent[name]) config.agent[name] = {};
      config.agent[name]!.disable = true;
    }

    // Set default_agent, clean legacy camelCase key
    config.default_agent = "architect";
    delete config.defaultAgent;

    writeConfig(configInfo.path, config);
    console.log(`Updated config: ${configInfo.path}\n`);
  }

  // Copy agents and skills into the global opencode config dir
  console.log("Installing agents and skills...");
  installAgentsAndSkills(globalDir);

  // Clean up stale agent files from previous cortex-agents versions
  cleanupStaleAgents(globalDir);

  // Sync per-project models if .opencode/models.json exists
  if (hasProjectModelsConfig()) {
    console.log("\nPer-project model config found (.opencode/models.json)");
    if (syncProjectModelsToConfig()) {
      console.log("  Synced model settings to local opencode.json");
    }
  }

  console.log("\nDone! Next steps:");
  console.log(`  1. Run 'npx ${PLUGIN_NAME} configure' to select your models (global)`);
  console.log(`     Or 'npx ${PLUGIN_NAME} configure --project' for per-project config`);
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

    // Re-enable built-in agents
    for (const name of DISABLED_BUILTIN_AGENTS) {
      if (config.agent[name]) {
        delete config.agent[name]!.disable;
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

  // Remove default_agent + clean legacy key
  delete config.default_agent;
  delete config.defaultAgent;

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
  const isProject = args.includes("--project");

  // Handle --reset flag
  if (isReset) {
    return configureReset(isProject);
  }

  const scope = isProject ? "Per-Project" : "Global";
  console.log(`\n🔧 Cortex Agents — ${scope} Model Configuration\n`);

  if (isProject) {
    const opencodeDir = path.join(process.cwd(), ".opencode");
    if (!fs.existsSync(opencodeDir)) {
      console.log(
        `⚠  No .opencode/ directory found in ${process.cwd()}.`
      );
      console.log(
        `   Run 'npx ${PLUGIN_NAME} install' first, or use 'configure' without --project for global config.\n`
      );
      process.exit(1);
    }
    console.log(`Project: ${process.cwd()}`);
    console.log(`Config:  .opencode/models.json + opencode.json\n`);
  }

  // Ensure plugin is installed first (for global mode)
  const configInfo = findOpencodeConfig();
  const config = configInfo
    ? readConfig(configInfo.path)
    : { $schema: "https://opencode.ai/config.json" as const };

  if (!isProject && !config.plugin?.includes(PLUGIN_NAME)) {
    console.log(
      `⚠  Plugin not installed. Adding '${PLUGIN_NAME}' to config first.\n`
    );
    if (!config.plugin) config.plugin = [];
    config.plugin.push(PLUGIN_NAME);
  }

  // Set default agent to architect (planning-first workflow)
  if (!config.default_agent) {
    config.default_agent = "architect";
  }
  // Clean legacy camelCase key
  delete config.defaultAgent;

  // ── Primary model selection ────────────────────────────────
  const { primary, subagent } = await promptModelSelection();

  // ── Write config ───────────────────────────────────────────
  if (isProject) {
    // Per-project: write .opencode/models.json + sync to local opencode.json
    writeProjectModels(primary, subagent);
    syncProjectModelsToConfig();

    // Ensure default agent is set in local opencode.json
    const localConfig = readConfig(path.join(process.cwd(), "opencode.json"));
    if (!localConfig.default_agent) {
      localConfig.default_agent = "architect";
    }
    // Clean legacy camelCase key
    delete localConfig.defaultAgent;
    writeConfig(path.join(process.cwd(), "opencode.json"), localConfig);

    const modelsPath = getProjectModelsPath();
    const localConfigPath = path.join(process.cwd(), "opencode.json");

    console.log("━".repeat(50));
    console.log(`✓ Per-project config saved:\n`);
    console.log(`  Models:  ${modelsPath}`);
    console.log(`  Runtime: ${localConfigPath}\n`);
  } else {
    // Global: write to opencode.json (existing behavior)
    if (!config.agent) config.agent = {};

    for (const name of PRIMARY_AGENTS) {
      if (!config.agent[name]) config.agent[name] = {};
      config.agent[name]!.model = primary;
    }

    for (const name of SUBAGENTS) {
      if (!config.agent[name]) config.agent[name] = {};
      config.agent[name]!.model = subagent;
    }

    // Re-assert disable entries for built-in agents
    for (const name of DISABLED_BUILTIN_AGENTS) {
      if (!config.agent[name]) config.agent[name] = {};
      config.agent[name]!.disable = true;
    }

    const targetPath =
      configInfo?.path || path.join(getGlobalDir(), "opencode.json");
    writeConfig(targetPath, config);

    console.log("━".repeat(50));
    console.log(`✓ Configuration saved to ${targetPath}\n`);
  }

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

/**
 * Interactive prompt for primary + subagent model selection.
 * Shared between global and per-project configure flows.
 */
async function promptModelSelection(): Promise<{
  primary: string;
  subagent: string;
}> {
  const primaryChoices = getPrimaryChoices();
  primaryChoices.push({
    title: "Enter custom model ID",
    description: "provider/model format",
    value: "__custom__",
  });

  console.log(
    "Primary agents (implement, architect, fix, audit) handle complex tasks.\nUse your best available model.\n"
  );

  const { primaryModel } = await prompts({
    type: "select",
    name: "primaryModel",
    message: "Select model for PRIMARY agents:",
    choices: primaryChoices,
    hint: "Use arrow keys, Enter to confirm",
  });

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
    "Subagents (crosslayer, qa, guard, ship) handle focused tasks.\nA faster/cheaper model works great here.\n"
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

  return { primary, subagent };
}

function configureReset(isProject: boolean = false): void {
  const scope = isProject ? "Per-Project" : "Global";
  console.log(`\n🔧 Cortex Agents — Reset ${scope} Model Configuration\n`);

  if (isProject) {
    // Reset per-project config
    const modelsPath = getProjectModelsPath();
    let removedModels = false;

    if (fs.existsSync(modelsPath)) {
      fs.unlinkSync(modelsPath);
      console.log(`✓ Removed ${modelsPath}`);
      removedModels = true;
    }

    // Also clean agent models from local opencode.json
    const localConfigPath = path.join(process.cwd(), "opencode.json");
    if (fs.existsSync(localConfigPath)) {
      const config = readConfig(localConfigPath);
      if (config.agent) {
        let resetCount = 0;
        for (const name of ALL_AGENTS) {
          if (config.agent[name]?.model) {
            delete config.agent[name]!.model;
            resetCount++;
            if (Object.keys(config.agent[name]!).length === 0) {
              delete config.agent[name];
            }
          }
        }
        if (Object.keys(config.agent).length === 0) {
          delete config.agent;
        }
        if (resetCount > 0) {
          writeConfig(localConfigPath, config);
          console.log(`✓ Removed ${resetCount} agent model entries from ${localConfigPath}`);
          removedModels = true;
        }
      }
    }

    if (!removedModels) {
      console.log("No per-project model configuration found. Nothing to reset.\n");
      return;
    }

    console.log("\nAgents will now fall back to global or OpenCode default models.");
    console.log("Restart OpenCode to apply changes.\n");
    return;
  }

  // Global reset (existing behavior)
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

  // Show per-project model configuration
  const projectModels = readProjectModels();
  if (projectModels) {
    console.log("\nPer-Project Models (.opencode/models.json):");
    console.log(`  Primary agents:  ${projectModels.primary.model}`);
    console.log(`  Subagents:       ${projectModels.subagent.model}`);
  }

  // Show global/active model configuration
  if (config.agent) {
    const primaryModels = PRIMARY_AGENTS.map(
      (n) => config.agent?.[n]?.model
    ).filter(Boolean);
    const subagentModels = SUBAGENTS.map(
      (n) => config.agent?.[n]?.model
    ).filter(Boolean);

    if (primaryModels.length > 0 || subagentModels.length > 0) {
      const source = projectModels ? "Active" : "Global";
      console.log(`\n${source} Model Configuration (opencode.json):`);

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
    } else if (!projectModels) {
      console.log("\nModels: Not configured (using OpenCode defaults)");
      console.log(
        `  Run 'npx ${PLUGIN_NAME} configure' for global config`
      );
      console.log(
        `  Run 'npx ${PLUGIN_NAME} configure --project' for per-project config`
      );
    }
  } else if (!projectModels) {
    console.log("\nModels: Not configured (using OpenCode defaults)");
    console.log(
      `  Run 'npx ${PLUGIN_NAME} configure' for global config`
    );
    console.log(
      `  Run 'npx ${PLUGIN_NAME} configure --project' for per-project config`
    );
  }

  if (!isInstalled) {
    console.log(`\nRun 'npx ${PLUGIN_NAME} install' to add to config.`);
  }
  console.log();
}

function help(): void {
  console.log(`${PLUGIN_NAME} v${VERSION}

Supercharge OpenCode with structured workflows, intelligent agents,
and automated development practices.

USAGE:
  npx ${PLUGIN_NAME} <command> [options]

COMMANDS:
  install              Install plugin, agents, and skills into OpenCode config
  configure            Interactive model selection (global)
  configure --project  Interactive model selection (per-project, saves to .opencode/)
  configure --reset    Reset model configuration to OpenCode defaults
  configure --project --reset  Reset per-project model configuration
  uninstall            Remove plugin, agents, skills, and model config
  status               Show installation and model configuration status
  help                 Show this help message

EXAMPLES:
  npx ${PLUGIN_NAME} install                    # Install plugin
  npx ${PLUGIN_NAME} configure                  # Global model selection
  npx ${PLUGIN_NAME} configure --project        # Per-project models (.opencode/models.json)
  npx ${PLUGIN_NAME} configure --reset          # Reset global models
  npx ${PLUGIN_NAME} configure --project --reset # Reset per-project models
  npx ${PLUGIN_NAME} status                     # Check status

AGENTS:
  Primary (implement, architect, fix, audit):
    Handle complex tasks — select your best model.

  Subagents (crosslayer, qa, guard, ship):
    Handle focused tasks — a fast/cheap model works great.

TOOLS (32):
  cortex_init, cortex_status      .cortex directory management
  cortex_configure                Per-project model configuration
  worktree_create, worktree_list  Git worktree management
  worktree_remove, worktree_open
  worktree_launch                 Launch worktree (terminal/PTY/background)
  detect_environment              Detect IDE/terminal for launch options
  get_environment_info            Quick environment info for agents
  branch_create, branch_status    Git branch operations
  branch_switch
  plan_save, plan_list            Plan persistence
  plan_load, plan_delete
  session_save, session_list      Session management
  session_load
  docs_init, docs_save            Mermaid documentation
  docs_list, docs_index
  task_finalize                   Commit, push, and create PR
  github_status, github_issues    GitHub issue and project browsing
  github_projects
  repl_init, repl_status          Iterative task-by-task implementation loop
  repl_report, repl_summary

SKILLS (14):
  frontend-development, backend-development, mobile-development,
  desktop-development, database-design, api-design,
  architecture-patterns, design-patterns, testing-strategies,
  security-hardening, deployment-automation, performance-optimization,
  code-quality, git-workflow
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
