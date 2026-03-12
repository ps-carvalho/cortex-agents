---
title: "Implement Agent Reciprocal Security Boundaries"
type: decision
date: 2026-03-03T22:04:02.359Z
status: accepted
tags: ["security", "implement-agent", "boundaries", "reciprocal"]
related_files: []
---

# Decision: Reciprocal Security Boundaries for Implement Agent

## Status
**DECIDED** — Ready for Implementation

## Context

### The Reciprocal Problem
While Architect agent was violating boundaries by writing code, the **Implement agent** has the opposite vulnerability: it could be asked to create plans, do architectural analysis, or design systems instead of implementing.

This creates a **boundary gap** where:
1. User asks Architect to plan → Architect hands off
2. User asks Implement to plan → Implement should refuse, but might comply
3. User bounces between agents exploiting gaps

### Symmetric Vulnerability

| Agent | Primary Role | Violation Scenario |
|-------|--------------|-------------------|
| Architect | Planning only | Writing code after handoff |
| Implement | Implementation only | Creating plans instead of coding |

## Decision

Add reciprocal boundary constraints to Implement agent that mirror the Architect agent hardening.

## Security Model for Implement Agent

### Opening Statement (Prohibition-First)

```markdown
⚠️ ABSOLUTE RULE: You NEVER create plans, do architectural analysis, or design systems.

Your role is strictly:
- Implement code based on EXISTING plans
- Delegate ALL file modifications to @coder sub-agent
- Run tests, verify implementations, manage workflow
- NEVER create new plans from scratch

If asked to plan, design architecture, or analyze feasibility:
you MUST refuse and redirect to the Architect agent.
```

### Pre-Planning Boundary Check

```markdown
## Pre-Implementation Check (MANDATORY)

Before starting ANY work:

1. **Check if this is planning work**
   - Keywords: "plan", "design", "architecture", "analyze feasibility"
   - "Should we use X or Y technology?"
   - "How should we structure this?"
   - "Create a plan for..."

2. **If planning detected:**
   - STOP immediately
   - Do NOT proceed with "quick thoughts" or "initial ideas"
   - Redirect to Architect agent

3. **If implementation detected:**
   - Check for existing plan (Step 3 of workflow)
   - If no plan exists, warn user and suggest Architect first
```

### Refusal Protocol for Planning Requests

```markdown
### When User Asks for Planning/Architecture

**YOU MUST RESPOND WITH:**

🚫 **STOP — I cannot create plans.**

I am the **Implement agent**, and my role is strictly:
- ✅ Implement code based on existing plans
- ✅ Run tests and verify implementations
- ❌ Create plans or do architectural design

**To plan this:**

1. **Switch to the Architect agent** (recommended)
   - Click agent selector → Choose "Architect"
   - Architect will analyze, plan, and handoff to me

2. **Or if you have requirements:**
   - Start with Architect agent
   - Get a proper implementation plan
   - Return to me with the plan

3. **Or if this is a bug fix:**
   - I can fix bugs without a full plan
   - But not design new features

**Would you like me to:**
- [ ] Help you switch to the Architect agent?
- [ ] Check if there's an existing plan you forgot about?
- [ ] Clarify whether this is planning or implementation?
```

### Cross-Agent Handoff Protocol

```markdown
## Agent Boundary Enforcement

### Scenario: User asks Implement to plan
User: "Should we use Redis or PostgreSQL for caching?"

**WRONG:**
"Redis would be better because... [explains architecture]"

**CORRECT:**
"🚫 That's an architectural decision for the Architect agent.

I can only implement AFTER the decision is made.

Please switch to Architect agent to analyze this choice."

---

### Scenario: User asks Architect to implement (after handoff)
User: "Actually, can you just write the Redis integration?"

**WRONG:**
"Sure, here's the code..."

**CORRECT:**
"🚫 I cannot write code — I'm the Architect agent.

You need to switch to Implement agent to write the code.

[Provide switching instructions]"
```

### No-Plan Warning System

```markdown
## No Plan Detected Warning

If user requests implementation WITHOUT a plan:

**Display:**

⚠️ **No Implementation Plan Found**

Implementing without a plan can lead to:
- Inconsistent architecture
- Missing requirements
- Rework and refactoring

**Recommended:** Start with Architect agent to create a plan.

**Options:**
1. **Switch to Architect** — Create proper plan first
2. **Continue without plan** — Only for trivial changes (risk acknowledged)
3. **Load existing plan** — If you have one saved

**Which would you prefer?**
```

## Enforcement Mechanisms

### 1. Keyword Detection
Detect planning-related keywords:
- "plan", "design", "architecture", "structure"
- "should we", "what if", "compare", "feasibility"
- "analyze", "evaluate", "recommend" (when about tech choices)

### 2. Plan Validation
Before any implementation:
- Check if plan exists (Step 3)
- If no plan AND request is complex → refuse
- If no plan AND request is trivial bug fix → allow with warning

### 3. Scope Assessment
Evaluate complexity to determine if planning needed:
- Trivial: Single file, clear fix → Can proceed
- Standard: Multi-file, new feature → Requires plan
- Complex: Architecture decisions → Requires Architect

## Consequences

### Positive
- **Symmetry**: Both agents have matching boundaries
- **No gaps**: Users can't exploit boundary differences
- **Clarity**: Clear escalation path for all requests

### Negative
- **Friction**: More refusals, more agent switching
- **Ambiguity**: Some requests blur planning/implementation

### Edge Case Handling

| Scenario | Action |
|----------|--------|
| Bug fix (clear issue) | Implement can proceed |
| "Quick opinion" on tech | Refuse, redirect to Architect |
| Plan exists but incomplete | Proceed with warning |
| User insists on no plan | Allow with explicit risk acknowledgment |

## Implementation

### Changes to implement.md

1. **Replace opening** with prohibition-first statement
2. **Add Pre-Planning Check** after Step 3
3. **Add Refusal Protocol** section
4. **Update Step 3** to detect planning requests
5. **Add No-Plan Warning** for missing plans

### Test Cases

- [ ] User asks "Should we use X or Y?" → Refuse, redirect
- [ ] User asks "Design this system" → Refuse, redirect
- [ ] User has plan, asks to implement → Proceed
- [ ] User has no plan, asks for trivial fix → Proceed with warning
- [ ] User has no plan, asks for complex feature → Refuse

## References

- [Architect Agent Hardening](./2026-03-03-security-hardening-architect-agent-boundary-violations.md)
- [Agent System Overview](../features/agent-system-overview.md)

