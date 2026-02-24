import { describe, it, expect } from "vitest";
import {
  extractPlanSections,
  buildPrBodyFromPlan,
  findPlanContent,
} from "../plan-extract.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("extractPlanSections", () => {
  it("extracts title from frontmatter", () => {
    const content = `---
title: "Auth System"
type: feature
---

# Auth System

## Summary

Implement authentication.

## Tasks

- [ ] Add login
- [ ] Add logout
`;
    const sections = extractPlanSections(content, "test.md");
    expect(sections.title).toBe("Auth System");
    expect(sections.summary).toContain("Implement authentication");
    expect(sections.tasks).toContain("Add login");
  });

  it("extracts title from heading when no frontmatter title", () => {
    const content = `# My Plan

## Summary

A summary here.
`;
    const sections = extractPlanSections(content, "test.md");
    expect(sections.title).toBe("My Plan");
    expect(sections.summary).toContain("A summary here");
  });

  it("extracts key decisions section", () => {
    const content = `# Plan

## Key Decisions

- Use JWT for auth
- Use PostgreSQL
`;
    const sections = extractPlanSections(content, "test.md");
    expect(sections.decisions).toContain("Use JWT");
    expect(sections.decisions).toContain("PostgreSQL");
  });

  it("handles empty plan", () => {
    const sections = extractPlanSections("", "empty.md");
    expect(sections.title).toBe("");
    expect(sections.summary).toBe("");
    expect(sections.tasks).toBe("");
    expect(sections.decisions).toBe("");
    expect(sections.filename).toBe("empty.md");
  });

  it("handles plan with no sections", () => {
    const content = "Just some text with no headings.";
    const sections = extractPlanSections(content, "no-sections.md");
    expect(sections.title).toBe("");
    expect(sections.summary).toBe("");
  });
});

describe("buildPrBodyFromPlan", () => {
  it("builds PR body with all sections", () => {
    const body = buildPrBodyFromPlan({
      title: "Auth",
      summary: "Add auth system",
      tasks: "- [ ] Login\n- [ ] Logout",
      decisions: "- Use JWT",
      filename: "plan.md",
    });
    expect(body).toContain("## Summary");
    expect(body).toContain("Add auth system");
    expect(body).toContain("## Tasks");
    expect(body).toContain("## Key Decisions");
    expect(body).toContain("plan.md");
  });

  it("returns fallback when no sections present", () => {
    const body = buildPrBodyFromPlan({
      title: "",
      summary: "",
      tasks: "",
      decisions: "",
      filename: "empty.md",
    });
    expect(body).toContain("empty.md");
    expect(body).not.toContain("## Summary");
  });

  it("omits missing sections", () => {
    const body = buildPrBodyFromPlan({
      title: "Test",
      summary: "Only a summary",
      tasks: "",
      decisions: "",
      filename: "test.md",
    });
    expect(body).toContain("## Summary");
    expect(body).not.toContain("## Tasks");
    expect(body).not.toContain("## Key Decisions");
  });
});

describe("findPlanContent", () => {
  it("returns null when plans dir does not exist", () => {
    const result = findPlanContent("/nonexistent/path");
    expect(result).toBeNull();
  });

  it("reads a specific plan file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-test-"));
    const plansDir = path.join(tmpDir, ".cortex", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, "test-plan.md"), "# Test Plan\n\nContent here.");

    const result = findPlanContent(tmpDir, "test-plan.md");
    expect(result).not.toBeNull();
    expect(result!.filename).toBe("test-plan.md");
    expect(result!.content).toContain("Test Plan");

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns null for missing specific plan", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-test-"));
    const plansDir = path.join(tmpDir, ".cortex", "plans");
    fs.mkdirSync(plansDir, { recursive: true });

    const result = findPlanContent(tmpDir, "nonexistent.md");
    expect(result).toBeNull();

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("finds most recent plan when no filename given", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-test-"));
    const plansDir = path.join(tmpDir, ".cortex", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
    fs.writeFileSync(path.join(plansDir, "2024-01-01-feature-old.md"), "Old plan");
    fs.writeFileSync(path.join(plansDir, "2024-02-01-feature-new.md"), "New plan");

    const result = findPlanContent(tmpDir);
    expect(result).not.toBeNull();
    // Most recent (sorted reverse) should be the "new" one
    expect(result!.filename).toBe("2024-02-01-feature-new.md");

    fs.rmSync(tmpDir, { recursive: true });
  });
});
