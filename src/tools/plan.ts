import { tool } from "@opencode-ai/plugin";
import * as fs from "fs";
import * as path from "path";

const CORTEX_DIR = ".cortex";
const PLANS_DIR = "plans";

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
  },
  async execute(args, context) {
    const { title, type, content, tasks } = args;
    
    const plansPath = ensureCortexDir(context.worktree);
    const datePrefix = getDatePrefix();
    const slug = slugify(title);
    const filename = `${datePrefix}-${type}-${slug}.md`;
    const filepath = path.join(plansPath, filename);

    // Build frontmatter
    const frontmatter = `---
title: "${title}"
type: ${type}
created: ${new Date().toISOString()}
status: draft
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
    const filepath = path.join(plansPath, filename);

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
    const filepath = path.join(plansPath, filename);

    if (!fs.existsSync(filepath)) {
      return `✗ Plan not found: ${filename}`;
    }

    fs.unlinkSync(filepath);

    return `✓ Deleted plan: ${filename}`;
  },
});

// Export with underscore suffix to avoid reserved word
export { delete_ as delete };
