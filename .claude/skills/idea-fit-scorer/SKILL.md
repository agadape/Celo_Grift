---
name: idea-fit-scorer
description: Pick the single best feature/idea to build NEXT for an EXISTING project, given a target program's real scoring function. Takes a list of candidate ideas (e.g. from hackathon-brain) and a project context, scores each on a weighted, fit-first rubric, applies hard disqualifiers, and returns one ranked recommendation with a runner-up. Use when choosing between several already-generated ideas for a shipping project — NOT for greenfield brainstorming. Trigger: "which idea should I build", "compare these ideas", "score ideas for fit", "idea-fit-scorer", "pick the best feature".
---

# Idea Fit Scorer

A selection function, not an idea generator. Assumes ideas already exist (from hackathon-brain, a backlog, or a brain-dump) and a **codebase already ships**. Its job: choose the ONE highest-EV idea to build next, weighted toward what actually moves the target program's scoring needle and toward what the existing code can support cheaply.

## When to use vs. not

- **Use** when: you have ≥2 candidate ideas, an existing project, and a known scoring/judging function (hackathon metrics, OKR, grant criteria). You want a ranked pick with reasoning.
- **Don't use** for: generating ideas from scratch (use hackathon-brain), or picking architecture/tech (use a design pass).

## Inputs (gather before scoring — ask if missing)

1. **Project context** — what already exists: contracts, pages, libs, deployed addresses. The more concrete, the better the Reuse score.
2. **Target scoring function** — how the program/judge actually decides. Be specific. Examples:
   - Celo Proof of Ship → AI-agent metrics: `on-chain tx count` + `unique user count` + GitHub commits/README + 4-min demo + Karma GAP milestones. **No human panel.**
   - Traditional hackathon → human judge panel thesis + demo wow.
   - Internal OKR → a specific KPI.
   The scoring function determines how the **Metric Leverage** axis is interpreted — restate it explicitly per run.
3. **Candidate ideas** — name + one-liner each.
4. **Constraints** — time window, team size, funds, what's off-limits.

## The rubric (weighted, fit-first)

Score each idea 1–10 per axis, multiply by weight, sum to a /10 weighted total. Weights are tuned so that **reuse + measurable impact** dominate — the two things that decide whether a feature ships in time AND counts.

| # | Axis | Weight | 1–10 means |
|---|------|:---:|---|
| 1 | **Codebase Fit / Reuse** | 0.20 | 10 = extends existing contract/UI/lib with minimal new surface; 1 = greenfield, new infra, new deploy |
| 2 | **Metric Leverage** | 0.25 | 10 = directly maximizes the target scoring function per unit effort (e.g. many small tx from many unique wallets when that IS the metric); 1 = no measurable impact on it |
| 3 | **Build Feasibility** | 0.20 | 10 = core shippable in <1 day, rest is polish; 1 = won't realistically finish in the window |
| 4 | **Demo Power** | 0.10 | 10 = a visible, screen-recordable "wow" in the demo; 1 = invisible/back-end-only |
| 5 | **Differentiation** | 0.10 | 10 = nothing like it in the ecosystem; 1 = 5 others already shipped it |
| 6 | **Business / Retention** | 0.15 | 10 = one-line revenue model + drives REPEAT usage; 1 = one-and-done, no revenue logic |

**Weighted total = Σ(score × weight)**, out of 10.

### Why these weights
- **Metric Leverage (0.25)** is highest: building the wrong-for-the-scoring-function feature loses even if it's elegant. Restate the scoring function each run so this axis is grounded, not guessed.
- **Reuse (0.20) + Feasibility (0.20) = 0.40** combined: for an *existing* project on a deadline, "can I ship it on top of what I have" is the dominant survival constraint. A perfect idea that needs a new contract + audit + 2 weeks loses to a good idea that extends a deployed contract.
- Demo/Differentiation are real but secondary when the scorer is an AI counting tx, not a human watching a pitch — drop their weight further if the program has no human demo step.

> **Adapt the weights to the scoring function.** If the target program IS a human pitch panel, raise Demo + Differentiation to 0.15 each and drop Metric Leverage to 0.15. State any reweighting at the top of the run.

## Hard disqualifiers (strike regardless of score)

- **Blockchain not load-bearing** — works just as well as a plain Web2 app → strike.
- **Won't ship** — Build Feasibility < 4 → strike (a 60%-done feature scores nothing).
- **Zero metric impact** — Metric Leverage < 4 when the program scores on that metric → strike.
- **No revenue logic** — can't state how it makes money in one sentence → cap Business at 4 (don't strike, but it can't win on Business alone).

## Output format

```
## Idea-Fit Ranking — [project] for [program]
Scoring function applied: [restate it in one line]
Weights: [default | reweighted because ...]

| Rank | Idea | Reuse·.20 | Metric·.25 | Feas·.20 | Demo·.10 | Diff·.10 | Biz·.15 | Weighted /10 | DQ? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ... | 9 | 10 | 9 | 7 | 6 | 8 | 8.7 | — |
...

🥇 [Winner] — [weighted]/10
  Why it wins: [2–3 sentences tied to reuse + the scoring function]
  Main risk: [one real risk + mitigation]
  First ship slice: [the smallest thing that already moves the metric]

🥈 [Runner-up] — [weighted]/10
  Pick instead if: [condition]
```

## Operating rules

- **Restate the scoring function before scoring.** If it's metric-based (tx/users), say so and weight Metric Leverage accordingly. If you can't state it, ask.
- **Ground every Metric Leverage score in the actual function** — "drives ~N tx from N unique wallets, and the program counts exactly that" beats "feels impactful."
- **Reward reuse honestly** — open the repo, name the contract/page/lib the idea extends. A high Reuse score must cite real existing code.
- **One winner, one runner-up.** Don't hedge across five. The point is a decision.
- **Name the first ship slice** — the minimal increment that already produces measurable metric movement, so the build can start immediately and start counting.
