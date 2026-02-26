import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";
import { git } from "../utils/shell.js";
import {
  TYPE_TO_PREFIX,
  parseFrontmatter,
  upsertFrontmatterField,
} from "../utils/plan-extract.js";

const CORTEX_DIR = ".cortex";
const PLANS_DIR = "plans";

const PROTECTED_BRANCHES = ["main", "master", "develop", "production", "staging"];

// Extract client type from the plugin input via inference
type Client = PluginInput["client"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

function getDatePrefix(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

function ensureCortexDir(worktree: string): string {
  const cortexPath = path.join(worktree, CORTEX_DIR);
  const plansPath = path.join(cortexPath, PLANS_DIR);

  if (!fs.existsSync(plansPath)) {
    fs.mkdirSync(plansPath, { recursive: true });
  }

  return plansPath;
}

export const save = tool({
  description:
    "Save an implementation plan to .cortex/plans/ with mermaid diagram support",
  args: {
    title: tool.schema.string().describe("Plan title (e.g., 'User Authentication System')"),
    type: tool.schema
      .enum(["feature", "bugfix", "refactor", "architecture", "spike", "docs"])
      .describe("Plan type"),
    content: tool.schema
      .string()
      .describe("Full plan content in markdown (can include mermaid diagrams)"),
    tasks: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Optional list of tasks"),
    branch: tool.schema
      .string()
      .optional()
      .describe("Optional branch name to store in frontmatter (set by plan_commit)"),
  },
  async execute(args, context) {
    const { title, type, content, tasks, branch } = args;
    
    const plansPath = ensureCortexDir(context.worktree);
    const datePrefix = getDatePrefix();
    const slug = slugify(title);
    const filename = `${datePrefix}-${type}-${slug}.md`;
    const filepath = path.join(plansPath, filename);

    // Build frontmatter
    const branchLine = branch ? `\nbranch: ${branch}` : "";
    const frontmatter = `---
title: "${title}"
type: ${type}
created: ${new Date().toISOString()}
status: draft${branchLine}
---

`;

    // Build task list if provided
    let taskSection = "";
    if (tasks && tasks.length > 0) {
      taskSection = `\n## Tasks\n\n${tasks.map((t) => `- [ ] ${t}`).join("\n")}\n`;
    }

    // Combine content
    const fullContent = frontmatter + `# ${title}\n\n` + content + taskSection;

    // Write file
    fs.writeFileSync(filepath, fullContent);

    return `✓ Plan saved successfully

File: ${filename}
Path: ${filepath}

The plan includes:
- Title: ${title}
- Type: ${type}
- Tasks: ${tasks?.length || 0}

You can load this plan later with plan_load or view all plans with plan_list.`;
  },
});

export const list = tool({
  description: "List all saved plans in .cortex/plans/",
  args: {
    type: tool.schema
      .enum(["feature", "bugfix", "refactor", "architecture", "spike", "docs", "all"])
      .optional()
      .describe("Filter by plan type (default: all)"),
  },
  async execute(args, context) {
    const { type = "all" } = args;
    const plansPath = path.join(context.worktree, CORTEX_DIR, PLANS_DIR);

    if (!fs.existsSync(plansPath)) {
      return `No plans found. The .cortex/plans/ directory doesn't exist.

Use plan_save to create your first plan, or cortex_init to initialize the directory.`;
    }

    const files = fs
      .readdirSync(plansPath)
      .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
      .sort()
      .reverse();

    if (files.length === 0) {
      return "No plans found in .cortex/plans/";
    }

    let output = "📋 Saved Plans:\n\n";

    for (const file of files) {
      const filepath = path.join(plansPath, file);
      const content = fs.readFileSync(filepath, "utf-8");

      // Parse frontmatter
      let title = file;
      let planType = "unknown";
      let created = "";
      let status = "draft";

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        const titleMatch = fm.match(/title:\s*"?([^"\n]+)"?/);
        const typeMatch = fm.match(/type:\s*(\w+)/);
        const createdMatch = fm.match(/created:\s*(\S+)/);
        const statusMatch = fm.match(/status:\s*(\w+)/);

        if (titleMatch) title = titleMatch[1];
        if (typeMatch) planType = typeMatch[1];
        if (createdMatch) created = createdMatch[1].split("T")[0];
        if (statusMatch) status = statusMatch[1];
      }

      // Filter by type if specified
      if (type !== "all" && planType !== type) {
        continue;
      }

      output += `• ${title}\n`;
      output += `  File: ${file}\n`;
      output += `  Type: ${planType} | Created: ${created} | Status: ${status}\n\n`;
    }

    return output.trim();
  },
});

export const load = tool({
  description: "Load a saved plan by filename",
  args: {
    filename: tool.schema.string().describe("Plan filename (e.g., '2024-02-22-feature-auth.md')"),
  },
  async execute(args, context) {
    const { filename } = args;
    const plansPath = path.join(context.worktree, CORTEX_DIR, PLANS_DIR);
    const filepath = path.resolve(plansPath, filename);
    const resolvedPlansDir = path.resolve(plansPath);

    // Prevent path traversal (../ or absolute paths)
    if (!filepath.startsWith(resolvedPlansDir + path.sep)) {
      return `✗ Invalid plan filename: path traversal not allowed`;
    }

    if (!fs.existsSync(filepath)) {
      return `✗ Plan not found: ${filename}

Use plan_list to see available plans.`;
    }

    const content = fs.readFileSync(filepath, "utf-8");

    return `📋 Plan: ${filename}
${"=".repeat(50)}

${content}`;
  },
});

export const delete_ = tool({
  description: "Delete a saved plan",
  args: {
    filename: tool.schema.string().describe("Plan filename to delete"),
  },
  async execute(args, context) {
    const { filename } = args;
    const plansPath = path.join(context.worktree, CORTEX_DIR, PLANS_DIR);
    const filepath = path.resolve(plansPath, filename);
    const resolvedPlansDir = path.resolve(plansPath);

    // Prevent path traversal (../ or absolute paths)
    if (!filepath.startsWith(resolvedPlansDir + path.sep)) {
      return `✗ Invalid plan filename: path traversal not allowed`;
    }

    if (!fs.existsSync(filepath)) {
      return `✗ Plan not found: ${filename}`;
    }

    fs.unlinkSync(filepath);

    return `✓ Deleted plan: ${filename}`;
  },
});

/**
 * Factory function that creates the plan_commit tool with access
 * to the OpenCode client for toast notifications.
 *
 * Creates a git branch from plan metadata, stages .cortex/ artifacts,
 * commits them, and writes the branch name back into the plan frontmatter.
 */
export function createCommit(client: Client) {
  return tool({
    description:
      "Create a git branch from a saved plan, commit .cortex/ artifacts to it, and " +
      "write the branch name into the plan frontmatter. Keeps main clean.",
    args: {
      planFilename: tool.schema
        .string()
        .describe("Plan filename from .cortex/plans/ (e.g., '2026-02-26-feature-auth.md')"),
      branchType: tool.schema
        .string()
        .optional()
        .describe("Override branch prefix (default: derived from plan type)"),
      branchName: tool.schema
        .string()
        .optional()
        .describe("Override branch slug (default: derived from plan title)"),
    },
    async execute(args, context) {
      const { planFilename, branchType, branchName: nameOverride } = args;
      const cwd = context.worktree;

      // ── 1. Validate: git repo ─────────────────────────────────
      try {
        await git(cwd, "rev-parse", "--git-dir");
      } catch {
        return "✗ Error: Not in a git repository. Initialize git first.";
      }

      // ── 2. Read and parse the plan ────────────────────────────
      const plansPath = path.join(cwd, CORTEX_DIR, PLANS_DIR);
      const filepath = path.resolve(plansPath, planFilename);
      const resolvedPlansDir = path.resolve(plansPath);

      // Prevent path traversal (../ or absolute paths)
      if (!filepath.startsWith(resolvedPlansDir + path.sep)) {
        return `✗ Invalid plan filename: path traversal not allowed`;
      }

      if (!fs.existsSync(filepath)) {
        return `✗ Plan not found: ${planFilename}

Use plan_list to see available plans.`;
      }

      let planContent = fs.readFileSync(filepath, "utf-8");
      const fm = parseFrontmatter(planContent);

      if (!fm) {
        return `✗ Plan has no frontmatter: ${planFilename}

Expected YAML frontmatter with title and type fields.`;
      }

      const planTitle = fm.title || "untitled";
      const planType = fm.type || "feature";

      // ── 3. Determine branch name ──────────────────────────────
      const VALID_PREFIXES = Object.values(TYPE_TO_PREFIX);
      const rawPrefix = branchType || TYPE_TO_PREFIX[planType] || "feature";
      const prefix = VALID_PREFIXES.includes(rawPrefix) ? rawPrefix : "feature";
      // Always sanitize name through slugify (even overrides)
      const slug = slugify(nameOverride || planTitle);
      const fullBranchName = `${prefix}/${slug}`;

      // ── 4. Check current branch ───────────────────────────────
      let currentBranch = "";
      try {
        const { stdout } = await git(cwd, "branch", "--show-current");
        currentBranch = stdout.trim();
      } catch {
        currentBranch = "";
      }

      const isOnProtected = PROTECTED_BRANCHES.includes(currentBranch);
      let branchCreated = false;

      // ── 5. Create or switch to branch ─────────────────────────
      if (isOnProtected || !currentBranch) {
        // Try to create the branch
        try {
          await git(cwd, "checkout", "-b", fullBranchName);
          branchCreated = true;
        } catch {
          // Branch may already exist — try switching to it
          try {
            await git(cwd, "checkout", fullBranchName);
          } catch (switchErr: any) {
            try {
              await client.tui.showToast({
                body: {
                  title: `Plan Commit: ${planFilename}`,
                  message: `Failed to create/switch branch: ${switchErr.message || switchErr}`,
                  variant: "error",
                  duration: 8000,
                },
              });
            } catch {
              // Toast failure is non-fatal
            }
            return `✗ Error creating branch '${fullBranchName}': ${switchErr.message || switchErr}

You may have uncommitted changes. Commit or stash them first.`;
          }
        }
      }
      // If already on a non-protected branch, skip branch creation

      // ── 6. Update plan frontmatter with branch ────────────────
      // If we created/switched to a new branch → use that name
      // If already on a non-protected branch → use whatever we're on
      const targetBranch = (isOnProtected || branchCreated) ? fullBranchName : currentBranch;

      planContent = upsertFrontmatterField(planContent, "branch", targetBranch);
      fs.writeFileSync(filepath, planContent);

      // ── 7. Stage .cortex/ directory ───────────────────────────
      try {
        await git(cwd, "add", path.join(cwd, CORTEX_DIR));
      } catch (stageErr: any) {
        return `✗ Error staging .cortex/ directory: ${stageErr.message || stageErr}`;
      }

      // ── 8. Commit ─────────────────────────────────────────────
      const commitMsg = `chore(plan): ${planTitle}`;
      let commitHash = "";

      try {
        // Check if there's anything staged
        const { stdout: statusOut } = await git(cwd, "status", "--porcelain");
        const stagedLines = statusOut
          .trim()
          .split("\n")
          .filter((l) => l && l[0] !== " " && l[0] !== "?");

        if (stagedLines.length === 0) {
          // Nothing to commit — plan already committed
          try {
            const { stdout: hashOut } = await git(cwd, "rev-parse", "--short", "HEAD");
            commitHash = hashOut.trim();
          } catch {
            commitHash = "(unknown)";
          }

          try {
            await client.tui.showToast({
              body: {
                title: `Plan: ${targetBranch}`,
                message: "Already committed — no new changes",
                variant: "info",
                duration: 4000,
              },
            });
          } catch {
            // Toast failure is non-fatal
          }

          return `✓ Plan already committed on branch: ${targetBranch}

Branch: ${targetBranch}
Commit: ${commitHash} (no new changes)
Plan: ${planFilename}

The plan branch is ready for implementation.
Use worktree_create or switch to the Implement agent.`;
        }

        await git(cwd, "commit", "-m", commitMsg);
        const { stdout: hashOut } = await git(cwd, "rev-parse", "--short", "HEAD");
        commitHash = hashOut.trim();
      } catch (commitErr: any) {
        try {
          await client.tui.showToast({
            body: {
              title: `Plan Commit`,
              message: `Commit failed: ${commitErr.message || commitErr}`,
              variant: "error",
              duration: 8000,
            },
          });
        } catch {
          // Toast failure is non-fatal
        }
        return `✗ Error committing: ${commitErr.message || commitErr}`;
      }

      // ── 9. Success notification ───────────────────────────────
      try {
        await client.tui.showToast({
          body: {
            title: `Plan Committed`,
            message: `${targetBranch} — ${commitHash}`,
            variant: "success",
            duration: 5000,
          },
        });
      } catch {
        // Toast failure is non-fatal
      }

      return `✓ Plan committed to branch

Branch: ${targetBranch}${branchCreated ? " (created)" : ""}
Commit: ${commitHash} — ${commitMsg}
Plan: ${planFilename}

The plan and .cortex/ artifacts are committed on '${targetBranch}'.
Main branch is clean.

Next steps:
  • Switch to Implement agent to begin coding
  • Or use worktree_create to work in an isolated copy`;
    },
  });
}

// Export with underscore suffix to avoid reserved word
export { delete_ as delete };
