/**
 * REPL Loop Utilities
 *
 * State management, plan task parsing, build/test command auto-detection,
 * and progress formatting for the implement agent's iterative task loop.
 *
 * State is persisted to `.cortex/repl-state.json` so it survives context
 * compaction, session restarts, and agent switches.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Constants ───────────────────────────────────────────────────────────────

const CORTEX_DIR = ".cortex";
const REPL_STATE_FILE = "repl-state.json";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in_progress" | "passed" | "failed" | "skipped";

export interface TaskIteration {
  /** ISO timestamp of this iteration */
  at: string;
  /** Outcome of this iteration */
  result: "pass" | "fail" | "skip";
  /** Test output summary, error message, or skip reason */
  detail: string;
}

export interface ReplTask {
  /** Zero-based index in the task list */
  index: number;
  /** Task description from the plan */
  description: string;
  /** Current status in the state machine */
  status: TaskStatus;
  /** Number of failed attempts (resets on pass) */
  retries: number;
  /** Full iteration history */
  iterations: TaskIteration[];
}

export interface ReplState {
  /** Source plan filename */
  planFilename: string;
  /** ISO timestamp when the loop started */
  startedAt: string;
  /** ISO timestamp when the loop completed (all tasks done or aborted) */
  completedAt?: string;
  /** Auto-detected or user-provided build command */
  buildCommand: string | null;
  /** Auto-detected or user-provided test command */
  testCommand: string | null;
  /** Optional lint command */
  lintCommand: string | null;
  /** Max retries per task before escalating to user (default: 3) */
  maxRetries: number;
  /** Index of the currently active task (-1 if not started) */
  currentTaskIndex: number;
  /** All tasks in the loop */
  tasks: ReplTask[];
}

export interface CommandDetection {
  buildCommand: string | null;
  testCommand: string | null;
  lintCommand: string | null;
  /** Detected framework name (e.g., "vitest", "jest", "pytest") */
  framework: string;
  /** Whether auto-detection found anything */
  detected: boolean;
}

// ─── Task Parsing ────────────────────────────────────────────────────────────

/**
 * Parse plan tasks from plan markdown content.
 *
 * Looks for unchecked checkbox items (`- [ ] ...`) in a `## Tasks` section.
 * Falls back to any unchecked checkboxes anywhere in the document.
 * Strips the `Task N:` prefix if present to get a clean description.
 */
export function parseTasksFromPlan(planContent: string): string[] {
  // Try to find a ## Tasks section first
  const tasksSection = extractTasksSection(planContent);
  const source = tasksSection || planContent;

  const tasks: string[] = [];
  const lines = source.split("\n");

  for (const line of lines) {
    // Match unchecked checkbox items: - [ ] Description
    const match = line.match(/^[-*]\s*\[\s\]\s+(.+)$/);
    if (match) {
      let description = match[1].trim();
      // Strip "Task N:" prefix if present
      description = description.replace(/^Task\s+\d+\s*:\s*/i, "");
      if (description) {
        tasks.push(description);
      }
    }
  }

  return tasks;
}

/**
 * Extract the content of the ## Tasks section from plan markdown.
 * Returns null if no Tasks section found.
 */
function extractTasksSection(content: string): string | null {
  const lines = content.split("\n");
  let inTasksSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (/^##\s+Tasks/i.test(line)) {
      inTasksSection = true;
      continue;
    }
    if (inTasksSection) {
      // End of section when we hit another ## heading
      if (/^##\s+/.test(line)) break;
      sectionLines.push(line);
    }
  }

  return sectionLines.length > 0 ? sectionLines.join("\n") : null;
}

// ─── Command Auto-Detection ──────────────────────────────────────────────────

/**
 * Auto-detect build, test, and lint commands from project configuration files.
 *
 * Detection priority:
 *   1. package.json (npm/node projects)
 *   2. Makefile
 *   3. Cargo.toml (Rust)
 *   4. go.mod (Go)
 *   5. pyproject.toml / setup.py (Python)
 *   6. mix.exs (Elixir)
 */
export async function detectCommands(cwd: string): Promise<CommandDetection> {
  const result: CommandDetection = {
    buildCommand: null,
    testCommand: null,
    lintCommand: null,
    framework: "unknown",
    detected: false,
  };

  // 1. Check package.json (most common for this project type)
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};
      const devDeps = pkg.devDependencies || {};
      const deps = pkg.dependencies || {};

      // Build command
      if (scripts.build) {
        result.buildCommand = "npm run build";
      }

      // Test command — prefer specific runner detection
      if (devDeps.vitest || deps.vitest) {
        result.testCommand = "npx vitest run";
        result.framework = "vitest";
      } else if (devDeps.jest || deps.jest) {
        result.testCommand = "npx jest";
        result.framework = "jest";
      } else if (devDeps.mocha || deps.mocha) {
        result.testCommand = "npx mocha";
        result.framework = "mocha";
      } else if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
        result.testCommand = "npm test";
        result.framework = "npm-test";
      }

      // Lint command
      if (scripts.lint) {
        result.lintCommand = "npm run lint";
      }

      result.detected = !!(result.buildCommand || result.testCommand);
      if (result.detected) return result;
    } catch {
      // Malformed package.json — continue to next detector
    }
  }

  // 2. Check Makefile
  const makefilePath = path.join(cwd, "Makefile");
  if (fs.existsSync(makefilePath)) {
    try {
      const makefile = fs.readFileSync(makefilePath, "utf-8");
      if (/^build\s*:/m.test(makefile)) {
        result.buildCommand = "make build";
      }
      if (/^test\s*:/m.test(makefile)) {
        result.testCommand = "make test";
        result.framework = "make";
      }
      if (/^lint\s*:/m.test(makefile)) {
        result.lintCommand = "make lint";
      }
      result.detected = !!(result.buildCommand || result.testCommand);
      if (result.detected) return result;
    } catch {
      // Continue to next detector
    }
  }

  // 3. Check Cargo.toml (Rust)
  if (fs.existsSync(path.join(cwd, "Cargo.toml"))) {
    result.buildCommand = "cargo build";
    result.testCommand = "cargo test";
    result.framework = "cargo";
    result.detected = true;
    return result;
  }

  // 4. Check go.mod (Go)
  if (fs.existsSync(path.join(cwd, "go.mod"))) {
    result.buildCommand = "go build ./...";
    result.testCommand = "go test ./...";
    result.framework = "go-test";
    result.detected = true;
    return result;
  }

  // 5. Check pyproject.toml or setup.py (Python)
  const pyprojectPath = path.join(cwd, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    try {
      const pyproject = fs.readFileSync(pyprojectPath, "utf-8");
      if (pyproject.includes("pytest")) {
        result.testCommand = "pytest";
        result.framework = "pytest";
      } else {
        result.testCommand = "python -m pytest";
        result.framework = "pytest";
      }
      result.detected = true;
      return result;
    } catch {
      // Continue
    }
  }
  if (fs.existsSync(path.join(cwd, "setup.py"))) {
    result.testCommand = "python -m pytest";
    result.framework = "pytest";
    result.detected = true;
    return result;
  }

  // 6. Check mix.exs (Elixir)
  if (fs.existsSync(path.join(cwd, "mix.exs"))) {
    result.buildCommand = "mix compile";
    result.testCommand = "mix test";
    result.framework = "ExUnit";
    result.detected = true;
    return result;
  }

  return result;
}

// ─── State Management ────────────────────────────────────────────────────────

/**
 * Get the path to the REPL state file.
 */
function statePath(cwd: string): string {
  return path.join(cwd, CORTEX_DIR, REPL_STATE_FILE);
}

/**
 * Read the current REPL state from .cortex/repl-state.json.
 * Returns null if no state file exists.
 */
export function readReplState(cwd: string): ReplState | null {
  const filepath = statePath(cwd);
  if (!fs.existsSync(filepath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8")) as ReplState;
  } catch {
    return null;
  }
}

/**
 * Write REPL state to .cortex/repl-state.json.
 * Uses atomic write (temp file + rename) to prevent corruption.
 */
export function writeReplState(cwd: string, state: ReplState): void {
  const filepath = statePath(cwd);
  const dir = path.dirname(filepath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Atomic write: write to temp, then rename
  const tmpPath = filepath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  fs.renameSync(tmpPath, filepath);
}

/**
 * Get the next pending task (first task with status "pending").
 * Returns null if all tasks are done.
 */
export function getNextTask(state: ReplState): ReplTask | null {
  return state.tasks.find((t) => t.status === "pending") ?? null;
}

/**
 * Get the currently in-progress task.
 * Returns null if no task is in progress.
 */
export function getCurrentTask(state: ReplState): ReplTask | null {
  return state.tasks.find((t) => t.status === "in_progress") ?? null;
}

/**
 * Check if the loop is complete (no pending or in_progress tasks).
 */
export function isLoopComplete(state: ReplState): boolean {
  return state.tasks.every(
    (t) => t.status === "passed" || t.status === "failed" || t.status === "skipped",
  );
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** Visual progress bar using block characters. */
function progressBar(done: number, total: number, width: number = 20): string {
  if (total === 0) return "░".repeat(width);
  const filled = Math.round((done / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/**
 * Format the current loop status as a human-readable string.
 * Used by repl_status tool output.
 */
export function formatProgress(state: ReplState): string {
  const total = state.tasks.length;
  const passed = state.tasks.filter((t) => t.status === "passed").length;
  const failed = state.tasks.filter((t) => t.status === "failed").length;
  const skipped = state.tasks.filter((t) => t.status === "skipped").length;
  const done = passed + failed + skipped;
  const pending = state.tasks.filter((t) => t.status === "pending").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const lines: string[] = [];

  lines.push(`Progress: ${progressBar(done, total)} ${done}/${total} tasks (${pct}%)`);
  lines.push(`  Passed: ${passed}  |  Failed: ${failed}  |  Skipped: ${skipped}  |  Pending: ${pending}`);

  // Current or next task
  const current = getCurrentTask(state);
  const next = getNextTask(state);

  if (current) {
    lines.push("");
    lines.push(`Current Task (#${current.index + 1}):`);
    lines.push(`  "${current.description}"`);
    if (current.retries > 0) {
      lines.push(`  Attempt: ${current.retries + 1}/${state.maxRetries}`);
    }
  } else if (next) {
    lines.push("");
    lines.push(`Next Task (#${next.index + 1}):`);
    lines.push(`  "${next.description}"`);
  } else if (isLoopComplete(state)) {
    lines.push("");
    lines.push("All tasks complete.");
  }

  // Commands
  lines.push("");
  lines.push(`Build: ${state.buildCommand || "(not detected)"}`);
  lines.push(`Test:  ${state.testCommand || "(not detected)"}`);
  if (state.lintCommand) {
    lines.push(`Lint:  ${state.lintCommand}`);
  }
  lines.push(`Max retries: ${state.maxRetries}`);

  // Task history
  lines.push("");
  lines.push("Task History:");
  for (const task of state.tasks) {
    const num = `#${task.index + 1}`;
    const iterInfo = task.iterations.length > 0
      ? ` (${task.iterations.length} iteration${task.iterations.length > 1 ? "s" : ""}${task.retries > 0 ? `, ${task.retries} retr${task.retries > 1 ? "ies" : "y"}` : ""})`
      : "";

    switch (task.status) {
      case "passed":
        lines.push(`  \u2713 ${num} ${task.description}${iterInfo}`);
        break;
      case "failed":
        lines.push(`  \u2717 ${num} ${task.description}${iterInfo}`);
        break;
      case "skipped":
        lines.push(`  \u2298 ${num} ${task.description}`);
        break;
      case "in_progress":
        lines.push(`  \u25B6 ${num} ${task.description}${iterInfo}`);
        break;
      case "pending":
        lines.push(`  \u25CB ${num} ${task.description}`);
        break;
    }
  }

  return lines.join("\n");
}

/**
 * Format a full summary of the loop results for PR body inclusion.
 * Returns a markdown block with a results table, counts, and timing.
 */
export function formatSummary(state: ReplState): string {
  const total = state.tasks.length;
  const passed = state.tasks.filter((t) => t.status === "passed").length;
  const failed = state.tasks.filter((t) => t.status === "failed").length;
  const skipped = state.tasks.filter((t) => t.status === "skipped").length;
  const totalIterations = state.tasks.reduce((sum, t) => sum + t.iterations.length, 0);

  const lines: string[] = [];

  lines.push("## REPL Loop Summary");
  lines.push("");
  lines.push("| # | Task | Status | Attempts |");
  lines.push("|---|------|--------|----------|");

  for (const task of state.tasks) {
    const num = task.index + 1;
    // Truncate long descriptions for the table
    const desc = task.description.length > 60
      ? task.description.substring(0, 57) + "..."
      : task.description;

    let statusIcon: string;
    let attempts: string;

    switch (task.status) {
      case "passed":
        statusIcon = "Passed";
        attempts = String(task.iterations.length);
        break;
      case "failed":
        statusIcon = "Failed";
        attempts = String(task.iterations.length);
        break;
      case "skipped":
        statusIcon = "Skipped";
        attempts = "—";
        break;
      case "in_progress":
        statusIcon = "In Progress";
        attempts = String(task.iterations.length);
        break;
      default:
        statusIcon = "Pending";
        attempts = "—";
    }

    lines.push(`| ${num} | ${desc} | ${statusIcon} | ${attempts} |`);
  }

  lines.push("");
  lines.push(`**Results: ${passed} passed, ${failed} failed, ${skipped} skipped** (${totalIterations} total iterations)`);

  // Timing
  if (state.startedAt) {
    const start = new Date(state.startedAt);
    const end = state.completedAt ? new Date(state.completedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const durationMin = Math.round(durationMs / 60_000);
    lines.push(`Duration: ${durationMin > 0 ? `${durationMin} minute${durationMin > 1 ? "s" : ""}` : "< 1 minute"}`);
  }

  lines.push(`Plan: ${state.planFilename}`);

  // List failed tasks with details if any
  const failedTasks = state.tasks.filter((t) => t.status === "failed");
  if (failedTasks.length > 0) {
    lines.push("");
    lines.push("### Failed Tasks");
    for (const task of failedTasks) {
      lines.push(`- **#${task.index + 1}**: ${task.description}`);
      const lastIter = task.iterations[task.iterations.length - 1];
      if (lastIter) {
        lines.push(`  Last error: ${lastIter.detail.substring(0, 200)}`);
      }
    }
  }

  return lines.join("\n");
}
