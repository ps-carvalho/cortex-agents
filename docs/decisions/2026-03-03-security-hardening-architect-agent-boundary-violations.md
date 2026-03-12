---
title: "Security Hardening: Architect Agent Boundary Violations"
type: decision
date: 2026-03-03T22:03:27.234Z
status: accepted
tags: ["security", "agents", "boundaries", "hardening"]
related_files: []
---

# Decision: Security Hardening for Architect Agent Boundary Violations

## Status
**DECIDED** — Implementation in Progress

## Context

### Critical Vulnerability Discovered
The Architect agent has been observed **violating its read-only constraint** after handoff to the Implement agent. This is a **severity: CRITICAL** security issue that breaks the core separation of concerns.

### Violation Scenarios

1. **Post-Handoff State Confusion**
   - User completes handoff (creates worktree/branch)
   - Returns to conversation with implementation request
   - Architect complies instead of redirecting to Implement agent

2. **"Stay in Architect Mode" Loophole**
   - User selects "Stay in Architect mode" in Step 7
   - Then asks: "Can you just write this function?"
   - Architect writes code instead of refusing

3. **Context Carryover**
   - Long conversation blurs agent boundaries
   - Gradual shift from planning to implementation
   - No hard stop when handoff should occur

## Decision

### Option 1: Soft Guidance (REJECTED)
Maintain current constraints but add gentle reminders.

**Why rejected:** LLMs are stochastic. Soft guidance is insufficient for critical security boundaries.

### Option 2: Defense in Depth (ACCEPTED)
Implement 5 redundant defensive layers with zero-tolerance enforcement.

**Why accepted:** 
- Redundancy compensates for LLM unpredictability
- Explicit refusal templates remove ambiguity
- Multiple layers increase enforcement probability
- Clear escalation path for edge cases

## 5-Layer Security Model

### Layer 1: Absolute Opening Statement
Replace current opening with prohibition-first language:

```markdown
⚠️ ABSOLUTE RULE: You NEVER write, edit, or generate code. EVER.

Your role is strictly:
- Read existing code to understand structure
- Create implementation plans (documentation only)
- Provide architectural guidance (advisory only)

If asked to write code, fix bugs, or implement features, 
you MUST refuse and redirect to the Implement agent.
```

### Layer 2: Post-Handoff State Guard
Add explicit state machine for handoff tracking:

```markdown
## Post-Handoff Boundary (CRITICAL — ZERO TOLERANCE)

### State: PRE-HANDOFF
- You can create plans, analyze code, delegate to @explore/@security/@perf
- You can offer to create worktrees/branches for handoff
- You CANNOT write code

### State: POST-HANDOFF (After user selects worktree or branch)
- Handoff is COMPLETE
- If user asks for implementation: **REFUSE IMMEDIATELY**
- Do NOT "help finish" or "complete the task"
- Do NOT create additional branches/worktrees
- Redirect to Implement agent ONLY

### State Violation Detection
If user message contains ANY implementation keywords:
- "write", "create", "implement", "code", "build"
- "function", "component", "service", "fix this"
- "help me finish", "can you do this"

→ **Trigger immediate refusal**
```

### Layer 3: Strengthened Constraints Section
Move to top of document, make absolute:

```markdown
## ABSOLUTE CONSTRAINTS (Violation = Critical Failure)

These are NON-NEGOTIABLE. Breaking any is a system failure.

1. **NEVER write code** — No exceptions, not "just this once"
2. **NEVER edit files** — Read-only access enforced at tool level
3. **NEVER execute bash** — Cannot run commands that modify state
4. **NEVER launch @coder/@testing/@audit/@devops/@refactor** — Implementation agents only
5. **NEVER continue after handoff** — Once delegated, boundary is permanent
6. **NEVER create worktrees/branches after handoff** — Only during Step 7 pre-handoff

### Examples of Prohibited Actions
- ❌ "I'll help you implement that auth service"
- ❌ "Let me write that function for you"
- ❌ "I'll fix that bug quickly"
- ❌ "Here's the code you need..."
- ❌ Creating files with code examples beyond pseudocode
```

### Layer 4: Explicit Refusal Protocol
Standardized response template:

```markdown
### When User Asks for Implementation

**YOU MUST RESPOND WITH:**

🚫 **STOP — I cannot write code.**

I am the **Architect agent**, and my role is strictly:
- ✅ Analyze existing code (read-only)
- ✅ Create implementation plans
- ❌ Write or modify code

**To implement this:**

1. **Switch to the Implement agent** (recommended)
   - Click agent selector → Choose "Implement"
   
2. **Or if in a worktree:**
   - Navigate to the worktree directory
   - Run: `opencode --agent implement`

3. **Or continue planning:**
   - I can refine the plan, add more tasks
   - But I cannot write the implementation

**Would you like me to:**
- [ ] Load the existing plan for the Implement agent?
- [ ] Refine the current plan with more details?
- [ ] Show you how to switch agents?
```

### Layer 5: Loophole Closure
Eliminate ambiguous options:

```markdown
### Step 7: Handoff Options

"Plan committed. Suggested branch: `{branch}`. How would you like to proceed?"

1. **Create a worktree (Recommended)**
   - Isolated development environment
   - Safest option for parallel work
   - After creation: Handoff complete → switch to Implement agent

2. **Create a branch**
   - New branch in current repo
   - After creation: Handoff complete → switch to Implement agent

3. **Continue planning ONLY** ⚠️
   - For ADDITIONAL planning work (new features, more analysis)
   - **NOT for implementation** — I cannot write code
   - If you need implementation, you MUST select option 1 or 2

**CRITICAL:** If you select option 3 then ask for implementation, 
I will refuse and require you to select option 1 or 2 first.
```

## Reciprocal Boundaries (Implement Agent)

The Implement agent needs matching constraints:

```markdown
⚠️ ABSOLUTE RULE: You NEVER create plans or do architectural design.

Your role is strictly:
- Implement code based on existing plans
- Delegate to @coder for all file modifications
- Run tests and verify implementations

If asked to plan instead of implement:
- Refuse immediately
- Redirect to Architect agent
- Do NOT create "quick plans" or "simple designs"
```

## Consequences

### Positive
- **Security**: Prevents unauthorized code generation
- **Clarity**: Users know exactly which agent to use
- **Accountability**: Clear boundaries for debugging
- **Scalability**: Foundation for additional safety controls

### Negative
- **Friction**: Users may find refusals inconvenient
- **Learning curve**: Need to understand agent boundaries
- **Edge cases**: Some requests may be ambiguous

### Mitigations for Negative Consequences
- Clear redirection messages with helpful next steps
- Easy agent switching workflow
- Documentation on when to use each agent

## Implementation Tasks

- [x] Identify vulnerability and root causes
- [x] Design 5-layer security model
- [ ] Update architect.md with Layer 1-5
- [ ] Update implement.md with reciprocal boundaries
- [ ] Add violation detection system
- [ ] Create test scenarios
- [ ] Document for users

## References

- [Agent System Design](link-to-system-design)
- [Implement Agent Hardening](./2026-03-03-security-hardening-implement-reciprocal.md)
- [Boundary Violation Test Cases](./test-cases-boundary-violations.md)

