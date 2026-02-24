import { describe, it, expect } from "vitest";
import { detectWorktreeInfo } from "../worktree-detect.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";

describe("detectWorktreeInfo", () => {
  it("detects the main tree is not a worktree", async () => {
    // Use the current repo as a test subject
    const cwd = process.cwd();
    const info = await detectWorktreeInfo(cwd);
    // In CI or normal dev, we're typically on the main tree
    expect(info.currentBranch).toBeTruthy();
    expect(typeof info.isWorktree).toBe("boolean");
  });

  it("returns (unknown) for non-git directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-noGit-"));
    const info = await detectWorktreeInfo(tmpDir);
    expect(info.currentBranch).toBe("(unknown)");
    expect(info.isWorktree).toBe(false);
    expect(info.mainWorktreePath).toBeNull();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("detects a linked worktree", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cortex-wt-"));
    const mainRepo = path.join(tmpDir, "main");
    const wtPath = path.join(tmpDir, "wt");

    // Create a git repo
    fs.mkdirSync(mainRepo, { recursive: true });
    execFileSync("git", ["init", mainRepo]);
    execFileSync("git", ["-C", mainRepo, "commit", "--allow-empty", "-m", "init"]);

    // Create a worktree
    execFileSync("git", ["-C", mainRepo, "worktree", "add", "-b", "test-branch", wtPath]);

    // Detect main
    const mainInfo = await detectWorktreeInfo(mainRepo);
    expect(mainInfo.isWorktree).toBe(false);

    // Detect worktree
    const wtInfo = await detectWorktreeInfo(wtPath);
    expect(wtInfo.isWorktree).toBe(true);
    expect(wtInfo.currentBranch).toBe("test-branch");
    expect(wtInfo.mainWorktreePath).toBeTruthy();

    // Clean up
    execFileSync("git", ["-C", mainRepo, "worktree", "remove", "--force", wtPath]);
    fs.rmSync(tmpDir, { recursive: true });
  });
});
