# ANIL X R&D Blueprint — 2026-09-18

## Product thesis
ANIL X should evolve from a static website into an adaptive, agent-ready personal operating layer:
intent -> experience DNA -> adaptive workspace -> agent tools -> verified result -> memory.

## Research-derived architecture

### 1. Intent layer
Translate natural language into task-centered intent:
- knowledge-seeking
- guidance-seeking
- output-seeking
Then refine with goal, urgency, complexity, risk, and desired modality.
Reference: CHI 2026 search-intent taxonomy and EACL 2026 RECAP.

### 2. Governable Experience DNA
Keep a coarse profile locally by default:
- goal
- interaction mode
- modality
- discovery appetite
- complexity tolerance
- visual density
- language
- active project
Expose "why this experience" and reset/override controls.
Do not infer sensitive traits.

### 3. Memory tiers
Use three tiers:
- session memory: current task
- project memory: durable decisions, assets, constraints
- preference memory: user-controlled experience settings
Only retrieve memory that improves the current task.
Consolidate/forget stale events rather than accumulating raw logs.
Reference: Microsoft RUMS, Memora, Human-Inspired Memory, MemoryQuest/PGR.

### 4. Adaptive workspace
Generate a task-specific workspace rather than changing the whole site arbitrarily.
Examples:
- BUILD workspace
- REPAIR workspace
- GROWTH workspace
- CREATIVE workspace
- DISCOVERY workspace
Keep ANIL X brand shell stable; adapt information density and tools inside the workspace.

### 5. Agent layer
Expose safe WebMCP tools:
read state -> prepare -> preview -> user approval -> consequential execution -> verify.
Never let untrusted page content override tool policy.
Use evals for tool selection, parameter correctness, state transitions, and refusal boundaries.

### 6. Discovery / hidden world
Use quests and meaningful unlocks, not points-only gamification.
Discovery can unlock:
- capabilities
- credits/discounts
- educational content
- secret workspaces
- lore
Never hide essential functionality behind puzzles.

### 7. Trust architecture
For risky operations show:
WHAT will happen
WHY it is needed
WHAT will change
COST
REVERSIBILITY
APPROVAL
RESULT
For payments use explicit authorization and spending limits.

### 8. Performance architecture
Fast path:
- static shell first
- no eager vision/self-tests
- lazy load heavy modules
- stream AI
- cancel stale requests
- minimize DOM churn
- measure INP/long tasks
Adaptive effects must never block primary actions.

### 9. Experiment engine
Every adaptive change should be measurable:
- activation
- task completion
- time-to-result
- abandonment
- correction rate
- user override/reset
- agent tool success
- payment conversion
Do not optimize solely for clicks.

### 10. Self-evolution boundary
AI may propose or generate a new workspace/component in a sandbox.
Production promotion requires deterministic checks and, for consequential changes, owner approval.
Never allow the public page to rewrite production code autonomously.

## Current implementation
- experience-dna.js: privacy-first local adaptive profile
- webmcp.js: progressive agent tool layer
- webmcp-evals.json: tool journey regression cases
- adaptive-shell.js: quick-start, guest mode, resume
- index.html and en.html wired to these layers

## Next implementation wave
1. Intent compiler
2. Project memory store
3. workspace renderer
4. explainable personalization panel
5. adaptive density modes
6. agent tool preview/approval state machine
7. discovery graph with real unlock inventory
8. event/eval telemetry without raw personal text
9. performance instrumentation
10. end-to-end browser-agent regression suite

## Non-goals
- private browsing-history scraping
- covert sensitive profiling
- autonomous payments
- autonomous production code changes
- claiming indexing/deployment/settlement without verification
