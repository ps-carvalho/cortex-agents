import type { Plugin } from "@opencode-ai/plugin";

// Import all tool modules
import * as cortex from "./tools/cortex";
import * as worktree from "./tools/worktree";
import * as branch from "./tools/branch";
import * as plan from "./tools/plan";
import * as session from "./tools/session";
import * as docs from "./tools/docs";
import * as task from "./tools/task";
import * as github from "./tools/github";
import * as repl from "./tools/repl";

// ─── Agent Descriptions (for handover toasts) ───────────────────────────────

const AGENT_DESCRIPTIONS: Record<string, string> = {
  implement: "Development mode — ready to implement",
  architect: "Planning mode — read-only analysis",
  fix: "Quick fix mode — fast turnaround",
  debug: "Debug subagent — root cause analysis",
  coder: "Coder subagent — multi-layer implementation",
  testing: "Testing subagent — writing tests",
  security: "Security subagent — vulnerability audit",
  devops: "DevOps subagent — CI/CD and deployment",
  audit: "Audit subagent — code quality assessment",
};

// ─── Tool Notification Config ────────────────────────────────────────────────
//
// Declarative map of tool → toast notification content.
// The `tool.execute.after` hook reads this map after every tool execution
// and fires a toast for tools listed here.
//
// Tools with existing factory-based toasts are NOT listed here to avoid
// double-notifications: worktree_create, worktree_remove, branch_create.
//
// Read-only tools are also excluded (plan_list, plan_load, session_list,
// session_load, docs_list, docs_index, cortex_status, branch_status,
// worktree_list, worktree_open).

interface ToolNotificationConfig {
  successTitle: string;
  successMsg: (args: any, output: string) => string;
  errorTitle: string;
  errorMsg: (args: any, output: string) => string;
  successDuration?: number; // default: 4000ms
  errorDuration?: number; // default: 8000ms
}

const TOOL_NOTIFICATIONS: Record<string, ToolNotificationConfig> = {
  task_finalize: {
    successTitle: "Task Finalized",
    successMsg: (args) =>
      `Committed & pushed: ${(args.commitMessage ?? "").substring(0, 50)}`,
    errorTitle: "Finalization Failed",
    errorMsg: (_, out) =>
      out
        .replace(/^✗\s*/, "")
        .split("\n")[0]
        .substring(0, 100),
    successDuration: 5000,
    errorDuration: 10000,
  },
  plan_save: {
    successTitle: "Plan Saved",
    successMsg: (args) => args.title ?? "Plan saved",
    errorTitle: "Plan Save Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  plan_delete: {
    successTitle: "Plan Deleted",
    successMsg: (args) => args.filename ?? "Plan deleted",
    errorTitle: "Plan Delete Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  // plan_commit — excluded: uses factory-based toasts in createCommit()
  session_save: {
    successTitle: "Session Saved",
    successMsg: () => "Session summary recorded",
    errorTitle: "Session Save Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  docs_save: {
    successTitle: "Documentation Saved",
    successMsg: (args) => `${args.type ?? "doc"}: ${args.title ?? "Untitled"}`,
    errorTitle: "Doc Save Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  docs_init: {
    successTitle: "Docs Initialized",
    successMsg: () => "Documentation directory created",
    errorTitle: "Docs Init Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  cortex_init: {
    successTitle: "Project Initialized",
    successMsg: () => ".cortex directory created",
    errorTitle: "Init Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  cortex_configure: {
    successTitle: "Models Configured",
    successMsg: (args) =>
      `Primary: ${args.primaryModel?.split("/").pop() || "set"}`,
    errorTitle: "Configure Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  branch_switch: {
    successTitle: "Branch Switched",
    successMsg: (args) => `Now on ${args.branch ?? "branch"}`,
    errorTitle: "Branch Switch Failed",
    errorMsg: (_, out) =>
      out
        .replace(/^✗\s*/, "")
        .split("\n")[0]
        .substring(0, 100),
  },
  github_status: {
    successTitle: "GitHub Connected",
    successMsg: (_args: any, output: string) => {
      const repoMatch = output.match(/Repository:\s+(.+)/);
      return repoMatch ? `Connected to ${repoMatch[1].substring(0, 100)}` : "GitHub CLI available";
    },
    errorTitle: "GitHub Not Available",
    errorMsg: (_, out) =>
      out
        .replace(/^✗\s*/, "")
        .split("\n")[0]
        .substring(0, 100),
  },
  repl_init: {
    successTitle: "REPL Loop Started",
    successMsg: (args) =>
      `${(args.planFilename ?? "Plan").split("/").pop()?.substring(0, 40)} — tasks loaded`,
    errorTitle: "REPL Init Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
  repl_report: {
    successTitle: "Task Update",
    successMsg: (args) => `Result: ${args.result ?? "reported"}`,
    errorTitle: "Report Failed",
    errorMsg: (_, out) => out.substring(0, 100),
  },
};

// ─── Error Message Extraction ────────────────────────────────────────────────
//
// Extracts a human-readable message from the session error union type
// (ProviderAuthError | UnknownError | MessageOutputLengthError |
//  MessageAbortedError | ApiError).

function extractErrorMessage(
  error?: { name: string; data: Record<string, unknown> } | null,
): string {
  if (!error) return "An unknown error occurred";

  const msg =
    typeof error.data?.message === "string" ? error.data.message : "";

  switch (error.name) {
    case "ProviderAuthError":
      return `Auth error: ${msg || "Provider authentication failed"}`;
    case "UnknownError":
      return msg || "An unknown error occurred";
    case "MessageOutputLengthError":
      return "Output length exceeded — try compacting the session";
    case "MessageAbortedError":
      return `Aborted: ${msg || "Message was aborted"}`;
    case "APIError":
      return `API error: ${msg || "Request failed"}`;
    default:
      return `Error: ${error.name}`;
  }
}

// ─── Plugin Entry ────────────────────────────────────────────────────────────

export const CortexPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      // Cortex tools - .cortex directory management
      cortex_init: cortex.init,
      cortex_status: cortex.status,
      cortex_configure: cortex.configure,

      // Worktree tools - git worktree management (factories for toast notifications)
      worktree_create: worktree.createCreate(ctx.client),
      worktree_list: worktree.list,
      worktree_remove: worktree.createRemove(ctx.client),
      worktree_open: worktree.open,

      // Branch tools - git branch operations (factory for toast notifications)
      branch_create: branch.createCreate(ctx.client),
      branch_status: branch.status,
      branch_switch: branch.switch_,

      // Plan tools - implementation plan persistence
      plan_save: plan.save,
      plan_list: plan.list,
      plan_load: plan.load,
      plan_delete: plan.delete_,
      plan_commit: plan.createCommit(ctx.client),

      // Session tools - session summaries with decisions
      session_save: session.save,
      session_list: session.list,
      session_load: session.load,

      // Documentation tools - mermaid docs for decisions, features, flows
      docs_init: docs.init,
      docs_save: docs.save,
      docs_list: docs.list,
      docs_index: docs.index,

      // Task tools - finalize workflow (commit, push, PR)
      task_finalize: task.finalize,

      // GitHub integration tools - work item listing, issue selection, project boards
      github_status: github.status,
      github_issues: github.issues,
      github_projects: github.projects,

      // REPL loop tools - iterative task-by-task implementation
      repl_init: repl.init,
      repl_status: repl.status,
      repl_report: repl.report,
      repl_summary: repl.summary,
    },

    // ── Post-execution toast notifications ────────────────────────────────
    //
    // Fires after every tool execution. Uses the TOOL_NOTIFICATIONS map
    // to determine which tools get toasts and what content to display.
    // Tools with existing factory-based toasts are excluded from the map.
    "tool.execute.after": async (input, output) => {
      const config = TOOL_NOTIFICATIONS[input.tool];
      if (!config) return; // No notification configured for this tool

      try {
        const result = output.output;
        const isSuccess = result.startsWith("✓");
        const isError = result.startsWith("✗");

        if (isSuccess) {
          await ctx.client.tui.showToast({
            body: {
              title: config.successTitle,
              message: config.successMsg(input.args, result),
              variant: "success",
              duration: config.successDuration ?? 4000,
            },
          });
        } else if (isError) {
          await ctx.client.tui.showToast({
            body: {
              title: config.errorTitle,
              message: config.errorMsg(input.args, result),
              variant: "error",
              duration: config.errorDuration ?? 8000,
            },
          });
        }
        // Informational or warning outputs (⚠) — no toast to avoid noise
      } catch {
        // Toast failure is non-fatal
      }
    },

    // ── Event-driven notifications ───────────────────────────────────────
    async event({ event }) {
      try {
        // Agent handover notifications
        if (
          event.type === "message.part.updated" &&
          "part" in event.properties &&
          event.properties.part.type === "agent"
        ) {
          const agentName = event.properties.part.name;
          const description =
            AGENT_DESCRIPTIONS[agentName] || `Switched to ${agentName}`;

          await ctx.client.tui.showToast({
            body: {
              title: `Agent: ${agentName}`,
              message: description,
              variant: "info",
              duration: 4000,
            },
          });
        }

        // Session error notifications
        if (event.type === "session.error") {
          const rawError = event.properties.error;
          // Runtime validation before cast — ensure error has expected shape
          const error =
            rawError &&
            typeof rawError === "object" &&
            "name" in rawError &&
            typeof (rawError as Record<string, unknown>).name === "string"
              ? (rawError as { name: string; data: Record<string, unknown> })
              : undefined;
          const message = extractErrorMessage(error);

          await ctx.client.tui.showToast({
            body: {
              title: "Session Error",
              message,
              variant: "error",
              duration: 10000,
            },
          });
        }

      } catch {
        // Toast failure is non-fatal — silently ignore
      }
    },
  };
};

// Default export for OpenCode plugin system
export default CortexPlugin;
