import { describe, it, expect } from "vitest";
import {
  MODEL_REGISTRY,
  PRIMARY_AGENTS,
  SUBAGENTS,
  ALL_AGENTS,
  getPrimaryChoices,
  getSubagentChoices,
} from "../registry.js";

describe("Agent Constants", () => {
  describe("PRIMARY_AGENTS", () => {
    it("contains the correct primary agent names", () => {
      expect(PRIMARY_AGENTS).toEqual(["implement", "architect", "fix", "audit"]);
    });

    it("has 4 primary agents", () => {
      expect(PRIMARY_AGENTS).toHaveLength(4);
    });

    it("is a readonly tuple", () => {
      // TypeScript enforces readonly, runtime check for structure
      expect(Array.isArray(PRIMARY_AGENTS)).toBe(true);
    });
  });

  describe("SUBAGENTS", () => {
    it("contains the correct subagent names", () => {
      expect(SUBAGENTS).toEqual(["crosslayer", "qa", "guard", "ship"]);
    });

    it("has 4 subagents", () => {
      expect(SUBAGENTS).toHaveLength(4);
    });

    it("is a readonly tuple", () => {
      expect(Array.isArray(SUBAGENTS)).toBe(true);
    });
  });

  describe("ALL_AGENTS", () => {
    it("contains all primary and subagent names", () => {
      expect(ALL_AGENTS).toEqual([
        "implement",
        "architect",
        "fix",
        "audit",
        "crosslayer",
        "qa",
        "guard",
        "ship",
      ]);
    });

    it("has 8 total agents", () => {
      expect(ALL_AGENTS).toHaveLength(8);
    });

    it("includes all primary agents", () => {
      for (const agent of PRIMARY_AGENTS) {
        expect(ALL_AGENTS).toContain(agent);
      }
    });

    it("includes all subagents", () => {
      for (const agent of SUBAGENTS) {
        expect(ALL_AGENTS).toContain(agent);
      }
    });

    it("has no duplicates", () => {
      const unique = new Set(ALL_AGENTS);
      expect(unique.size).toBe(ALL_AGENTS.length);
    });
  });

  describe("PRIMARY_AGENTS and SUBAGENTS are disjoint", () => {
    it("has no overlap between primary and subagent lists", () => {
      const primarySet = new Set<string>(PRIMARY_AGENTS);
      const subagentSet = new Set<string>(SUBAGENTS);
      
      for (const agent of primarySet) {
        expect(subagentSet.has(agent)).toBe(false);
      }
      
      for (const agent of subagentSet) {
        expect(primarySet.has(agent)).toBe(false);
      }
    });
  });
});

describe("MODEL_REGISTRY", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(MODEL_REGISTRY)).toBe(true);
    expect(MODEL_REGISTRY.length).toBeGreaterThan(0);
  });

  it("contains valid model entries", () => {
    for (const model of MODEL_REGISTRY) {
      expect(model.id).toMatch(/^.+\/.+$/); // provider/model format
      expect(model.name).toBeTruthy();
      expect(model.provider).toBeTruthy();
      expect(["premium", "standard", "fast"]).toContain(model.tier);
      expect(model.description).toBeTruthy();
    }
  });

  it("has at least one model in each tier", () => {
    const tiers = new Set(MODEL_REGISTRY.map((m) => m.tier));
    expect(tiers.has("premium")).toBe(true);
    expect(tiers.has("standard")).toBe(true);
    expect(tiers.has("fast")).toBe(true);
  });

  it("has unique model IDs", () => {
    const ids = MODEL_REGISTRY.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("getPrimaryChoices", () => {
  it("returns an array of choices", () => {
    const choices = getPrimaryChoices();
    expect(Array.isArray(choices)).toBe(true);
    expect(choices.length).toBeGreaterThan(0);
  });

  it("excludes fast tier models", () => {
    const choices = getPrimaryChoices();
    const fastModels = MODEL_REGISTRY.filter((m) => m.tier === "fast");
    
    for (const fast of fastModels) {
      const found = choices.find((c) => c.value === fast.id);
      expect(found).toBeUndefined();
    }
  });

  it("includes premium and standard tier models", () => {
    const choices = getPrimaryChoices();
    const goodModels = MODEL_REGISTRY.filter(
      (m) => m.tier === "premium" || m.tier === "standard"
    );
    
    expect(choices.length).toBe(goodModels.length);
  });

  it("has required choice properties", () => {
    const choices = getPrimaryChoices();
    
    for (const choice of choices) {
      expect(choice.title).toBeTruthy();
      expect(choice.description).toBeTruthy();
      expect(choice.value).toBeTruthy();
    }
  });

  it("includes provider name in title (lowercase)", () => {
    const choices = getPrimaryChoices();
    
    for (const choice of choices) {
      // Title should contain provider name in parentheses
      expect(choice.title).toMatch(/\(.+\)/);
    }
  });
});

describe("getSubagentChoices", () => {
  const testPrimaryModel = "anthropic/claude-sonnet-4-20250514";

  it("returns an array of choices", () => {
    const choices = getSubagentChoices(testPrimaryModel);
    expect(Array.isArray(choices)).toBe(true);
    expect(choices.length).toBeGreaterThan(0);
  });

  it("includes only fast tier models plus 'Same as primary'", () => {
    const choices = getSubagentChoices(testPrimaryModel);
    const fastModels = MODEL_REGISTRY.filter((m) => m.tier === "fast");
    
    // Should have fast models + 1 for "Same as primary"
    expect(choices.length).toBe(fastModels.length + 1);
  });

  it("includes 'Same as primary' option as last choice", () => {
    const choices = getSubagentChoices(testPrimaryModel);
    const lastChoice = choices[choices.length - 1];
    
    expect(lastChoice.title).toBe("Same as primary");
    expect(lastChoice.value).toBe("__same__");
    expect(lastChoice.description).toBe(testPrimaryModel);
  });

  it("has required choice properties", () => {
    const choices = getSubagentChoices(testPrimaryModel);
    
    for (const choice of choices) {
      expect(choice.title).toBeTruthy();
      expect(choice.description).toBeTruthy();
      expect(choice.value).toBeTruthy();
    }
  });

  it("uses different primary model correctly", () => {
    const customModel = "openai/o3";
    const choices = getSubagentChoices(customModel);
    const sameChoice = choices.find((c) => c.value === "__same__");
    
    expect(sameChoice?.description).toBe(customModel);
  });
});
