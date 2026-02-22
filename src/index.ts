import type { Plugin } from "@opencode-ai/plugin";

// Import all tool modules
import * as cortex from "./tools/cortex";
import * as worktree from "./tools/worktree";
import * as branch from "./tools/branch";
import * as plan from "./tools/plan";
import * as session from "./tools/session";

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
    },
  };
};

// Default export for OpenCode plugin system
export default CortexPlugin;
