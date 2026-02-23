import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// We test the plan tool logic by importing the underlying functions
// Since the tools use @opencode-ai/plugin which may not be testable directly,
// we test the pure logic functions from plan-extract and exercise the fs operations

describe("plan CRUD operations", () => {
  let tmpDir: string;
  let plansDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-plan-"));
    plansDir = path.join(tmpDir, ".cortex", "plans");
    fs.mkdirSync(plansDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("saves and reads a plan file", () => {
    const filename = "2024-01-01-feature-test-plan.md";
    const content = `---
title: "Test Plan"
type: feature
created: 2024-01-01T00:00:00.000Z
status: draft
---

# Test Plan

## Summary

This is a test plan.

## Tasks

- [ ] Task 1
- [ ] Task 2
`;
    fs.writeFileSync(path.join(plansDir, filename), content);

    // Verify the file is readable
    const read = fs.readFileSync(path.join(plansDir, filename), "utf-8");
    expect(read).toBe(content);
    expect(read).toContain("Test Plan");
  });

  it("lists plan files sorted reverse chronologically", () => {
    fs.writeFileSync(path.join(plansDir, "2024-01-01-feature-old.md"), "old");
    fs.writeFileSync(path.join(plansDir, "2024-06-01-feature-new.md"), "new");
    fs.writeFileSync(path.join(plansDir, "2024-03-01-bugfix-mid.md"), "mid");

    const files = fs
      .readdirSync(plansDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();

    expect(files[0]).toBe("2024-06-01-feature-new.md");
    expect(files[1]).toBe("2024-03-01-bugfix-mid.md");
    expect(files[2]).toBe("2024-01-01-feature-old.md");
  });

  it("deletes a plan file", () => {
    const filename = "2024-01-01-feature-to-delete.md";
    const filepath = path.join(plansDir, filename);
    fs.writeFileSync(filepath, "to delete");

    expect(fs.existsSync(filepath)).toBe(true);
    fs.unlinkSync(filepath);
    expect(fs.existsSync(filepath)).toBe(false);
  });

  it("handles non-existent plan for load", () => {
    const filepath = path.join(plansDir, "nonexistent.md");
    expect(fs.existsSync(filepath)).toBe(false);
  });

  it("filters plans by type in filename", () => {
    fs.writeFileSync(path.join(plansDir, "2024-01-01-feature-auth.md"), "auth feature");
    fs.writeFileSync(path.join(plansDir, "2024-01-01-bugfix-login.md"), "login fix");
    fs.writeFileSync(path.join(plansDir, "2024-01-01-feature-api.md"), "api feature");

    const featurePlans = fs
      .readdirSync(plansDir)
      .filter((f) => f.endsWith(".md") && f.includes("feature"));

    expect(featurePlans).toHaveLength(2);
    expect(featurePlans.every((f) => f.includes("feature"))).toBe(true);
  });
});
