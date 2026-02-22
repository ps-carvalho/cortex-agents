import type { Plugin } from "@opencode-ai/plugin";

// Import all tool modules
import * as cortex from "./tools/cortex";
import * as worktree from "./tools/worktree";
import * as branch from "./tools/branch";
import * as plan from "./tools/plan";
import * as session from "./tools/session";
import * as docs from "./tools/docs";
import * as task from "./tools/task";

// Agent descriptions for handover toast notifications
const AGENT_DESCRIPTIONS: Record<string, string> = {
  build: "Development mode — ready to implement",
  plan: "Planning mode — read-only analysis",
  debug: "Debug mode — troubleshooting and fixes",
  fullstack: "Fullstack subagent — end-to-end implementation",
  testing: "Testing subagent — writing tests",
  security: "Security subagent — vulnerability audit",
  devops: "DevOps subagent — CI/CD and deployment",
};

export const CortexPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      // Cortex tools - .cortex directory management
      cortex_init: cortex.init,
      cortex_status: cortex.status,

      // Worktree tools - git worktree management
      worktree_create: worktree.create,
      worktree_list: worktree.list,
      worktree_remove: worktree.remove,
      worktree_open: worktree.open,
      // Dynamic tool: needs client + shell via factory (closure injection)
      worktree_launch: worktree.createLaunch(ctx.client, ctx.$),

      // Branch tools - git branch operations
      branch_create: branch.create,
      branch_status: branch.status,
      branch_switch: branch.switch_,

      // Plan tools - implementation plan persistence
      plan_save: plan.save,
      plan_list: plan.list,
      plan_load: plan.load,
      plan_delete: plan.delete_,

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
    },

    // Agent handover toast notifications
    async event({ event }) {
      try {
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
      } catch {
        // Toast failure is non-fatal — silently ignore
      }
    },
  };
};

// Default export for OpenCode plugin system
export default CortexPlugin;
