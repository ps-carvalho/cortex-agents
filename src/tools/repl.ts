/**
 * REPL Loop Tools
 *
 * Four tools for the implement agent's iterative task-by-task development loop:
 *   - repl_init    — Initialize a loop from a plan
 *   - repl_status  — Get current progress and next task
 *   - repl_report  — Report task outcome (pass/fail/skip)
 *   - repl_summary — Generate markdown summary for PR body
 */

import { tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";
import {
  parseTasksFromPlan,
  detectCommands,
  readReplState,
  writeReplState,
  getNextTask,
  getCurrentTask,
  isLoopComplete,
  formatProgress,
  formatSummary,
  type ReplState,
  type ReplTask,
} from "../utils/repl.js";

const CORTEX_DIR = ".cortex";
const PLANS_DIR = "plans";

// ─── repl_init ───────────────────────────────────────────────────────────────

export const init = tool({
  description:
    "Initialize a REPL implementation loop from a plan. Parses plan tasks, " +
    "auto-detects build/test commands, and creates .cortex/repl-state.json " +
    "for tracking progress through each task iteratively.",
  args: {
    planFilename: tool.schema
      .string()
      .describe("Plan filename from .cortex/plans/ to load tasks from"),
    buildCommand: tool.schema
      .string()
      .optional()
      .describe("Override auto-detected build command (e.g., 'npm run build')"),
    testCommand: tool.schema
      .string()
      .optional()
      .describe("Override auto-detected test command (e.g., 'npm test')"),
    maxRetries: tool.schema
      .number()
      .optional()
      .describe("Max retries per failing task before escalating to user (default: 3)"),
  },
  async execute(args, context) {
    const { planFilename, buildCommand, testCommand, maxRetries = 3 } = args;
    const cwd = context.worktree;

    // 1. Validate plan filename
    if (!planFilename || planFilename === "." || planFilename === "..") {
      return `\u2717 Error: Invalid plan filename.`;
    }

    const plansDir = path.join(cwd, CORTEX_DIR, PLANS_DIR);
    const planPath = path.resolve(plansDir, planFilename);
    const resolvedPlansDir = path.resolve(plansDir);

    // Prevent path traversal — resolved path must be strictly inside plans dir
    if (!planPath.startsWith(resolvedPlansDir + path.sep)) {
      return `\u2717 Error: Invalid plan filename.`;
    }

    if (!fs.existsSync(planPath)) {
      return `\u2717 Error: Plan not found: ${planFilename}\n\nUse plan_list to see available plans.`;
    }

    const planContent = fs.readFileSync(planPath, "utf-8");

    // 2. Parse tasks from plan
    const taskDescriptions = parseTasksFromPlan(planContent);
    if (taskDescriptions.length === 0) {
      return `\u2717 Error: No tasks found in plan: ${planFilename}\n\nThe plan must contain unchecked checkbox items (- [ ] ...) in a ## Tasks section.`;
    }

    // 3. Auto-detect commands (or use overrides)
    const detected = await detectCommands(cwd);
    const finalBuild = buildCommand ?? detected.buildCommand;
    const finalTest = testCommand ?? detected.testCommand;

    // 4. Build initial state
    const tasks: ReplTask[] = taskDescriptions.map((desc, i) => ({
      index: i,
      description: desc,
      status: "pending" as const,
      retries: 0,
      iterations: [],
    }));

    const state: ReplState = {
      planFilename,
      startedAt: new Date().toISOString(),
      buildCommand: finalBuild,
      testCommand: finalTest,
      lintCommand: detected.lintCommand,
      maxRetries,
      currentTaskIndex: -1,
      tasks,
    };

    // 5. Write state
    writeReplState(cwd, state);

    // 6. Format output
    const cmdInfo = detected.detected
      ? `Auto-detected (${detected.framework})`
      : "Not detected \u2014 provide overrides if needed";

    return `\u2713 REPL loop initialized

Plan: ${planFilename}
Tasks: ${tasks.length}
Detection: ${cmdInfo}

Build: ${finalBuild || "(none)"}
Test:  ${finalTest || "(none)"}
${detected.lintCommand ? `Lint:  ${detected.lintCommand}` : ""}
Max retries: ${maxRetries}

First task (#1):
  "${tasks[0].description}"

Run \`repl_status\` to begin, then implement the task and run build/tests.`;
  },
});

// ─── repl_status ─────────────────────────────────────────────────────────────

export const status = tool({
  description:
    "Get the current REPL loop progress \u2014 which task is active, " +
    "what\u2019s been completed, retry counts, and detected build/test commands. " +
    "Call this to decide what to implement next.",
  args: {},
  async execute(args, context) {
    const state = readReplState(context.worktree);
    if (!state) {
      return `\u2717 No REPL loop active.\n\nRun repl_init with a plan filename to start a loop.`;
    }

    // Auto-advance: if no task is in_progress, promote the next pending task
    const current = getCurrentTask(state);
    if (!current && !isLoopComplete(state)) {
      const next = getNextTask(state);
      if (next) {
        next.status = "in_progress";
        state.currentTaskIndex = next.index;
        writeReplState(context.worktree, state);
      }
    }

    return `\u2713 REPL Loop Status\n\n${formatProgress(state)}`;
  },
});

// ─── repl_report ─────────────────────────────────────────────────────────────

export const report = tool({
  description:
    "Report the outcome of the current task iteration. " +
    "After implementing a task and running build/tests, report whether it passed, " +
    "failed, or should be skipped. The loop will auto-advance on pass, " +
    "retry on fail (up to max), or escalate to user when retries exhausted.",
  args: {
    result: tool.schema
      .enum(["pass", "fail", "skip"])
      .describe(
        "Task result: 'pass' (build+tests green), 'fail' (something broke), 'skip' (defer task)",
      ),
    detail: tool.schema
      .string()
      .describe("Result details: test output summary, error message, or skip reason"),
  },
  async execute(args, context) {
    const { result, detail } = args;
    const state = readReplState(context.worktree);

    if (!state) {
      return `\u2717 No REPL loop active. Run repl_init first.`;
    }

    // Find the current in_progress task
    const current = getCurrentTask(state);
    if (!current) {
      // Try to find the task at currentTaskIndex
      if (state.currentTaskIndex >= 0 && state.currentTaskIndex < state.tasks.length) {
        const task = state.tasks[state.currentTaskIndex];
        if (task.status === "pending") {
          task.status = "in_progress";
        }
        return processReport(state, task, result, detail, context.worktree);
      }
      return `\u2717 No task is currently in progress.\n\nRun repl_status to advance to the next task.`;
    }

    return processReport(state, current, result, detail, context.worktree);
  },
});

/**
 * Process a report for a task and update state.
 */
function processReport(
  state: ReplState,
  task: ReplTask,
  result: "pass" | "fail" | "skip",
  detail: string,
  cwd: string,
): string {
  // Record iteration
  task.iterations.push({
    at: new Date().toISOString(),
    result,
    detail: detail.substring(0, 2000), // Cap detail length
  });

  const taskNum = task.index + 1;
  const taskDesc = task.description;
  let output: string;

  switch (result) {
    case "pass": {
      task.status = "passed";
      const attempt = task.iterations.length;
      const suffix = attempt === 1 ? "1st" : attempt === 2 ? "2nd" : attempt === 3 ? "3rd" : `${attempt}th`;
      output = `\u2713 Task #${taskNum} PASSED (${suffix} attempt)\n  "${taskDesc}"\n  Detail: ${detail.substring(0, 200)}`;
      break;
    }

    case "fail": {
      task.retries += 1;
      const attempt = task.iterations.length;

      if (task.retries >= state.maxRetries) {
        // Retries exhausted
        task.status = "failed";
        output = `\u2717 Task #${taskNum} FAILED \u2014 retries exhausted (${attempt}/${state.maxRetries} attempts)\n  "${taskDesc}"\n  Detail: ${detail.substring(0, 200)}\n\n\u2192 ASK THE USER how to proceed. Suggest: fix manually, skip task, or abort loop.`;
      } else {
        // Retries remaining — stay in_progress
        const remaining = state.maxRetries - task.retries;
        output = `\u26A0 Task #${taskNum} FAILED (attempt ${attempt}/${state.maxRetries})\n  "${taskDesc}"\n  Detail: ${detail.substring(0, 200)}\n\n\u2192 Fix the issue and run build/tests again. ${remaining} retr${remaining > 1 ? "ies" : "y"} remaining.`;

        // Don't advance — keep task in_progress
        writeReplState(cwd, state);
        return output;
      }
      break;
    }

    case "skip": {
      task.status = "skipped";
      output = `\u2298 Task #${taskNum} SKIPPED\n  "${taskDesc}"\n  Reason: ${detail.substring(0, 200)}`;
      break;
    }
  }

  // Advance to next task
  const next = getNextTask(state);
  if (next) {
    next.status = "in_progress";
    state.currentTaskIndex = next.index;
    output += `\n\n\u2192 Next: Task #${next.index + 1} "${next.description}"`;
  } else {
    // All tasks done
    state.currentTaskIndex = -1;
    state.completedAt = new Date().toISOString();
    output += "\n\n\u2713 All tasks complete. Run repl_summary to generate the results report, then proceed to the quality gate (Step 7).";
  }

  writeReplState(cwd, state);
  return output;
}

// ─── repl_summary ────────────────────────────────────────────────────────────

export const summary = tool({
  description:
    "Generate a formatted summary of the REPL loop results for inclusion in " +
    "the quality gate report and PR body. Call after all tasks are complete " +
    "or when the loop is terminated.",
  args: {},
  async execute(args, context) {
    const state = readReplState(context.worktree);
    if (!state) {
      return `\u2717 No REPL loop data found.\n\nRun repl_init to start a loop, or this may have been cleaned up already.`;
    }

    return formatSummary(state);
  },
});
