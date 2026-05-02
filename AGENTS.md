# AGENTS.md

Generally speaking, you should browse the codebase to figure out what is going on.

## Task Completion Requirements

- All of `pnpm fmt`, `pnpm lint`, and `pnpm typecheck` must pass before considering tasks completed.
- Never write a useEffect. If you really think you need to, see the no-use-effect skill.

## Project Snapshot

This is a hackathon project to create the best agent infrastructure.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Visual consistency first. Adhere to the visual style of the existing site.

If a tradeoff is required, choose correctness and robustness over short-term convenience.

Do not add excessive fallbacks. Logic should be simple, with reasonable expecations, don't `try except` everything. Use the smallest possible diff. Then think of how to make it smaller. No typeof checks. No backwards compatability. Smallest possible set of changes to make the instructed change work.

Keep files under ~400 lines. Refactor as neeeded to meet this.

## Maintainability

This project is greenfield, sweeping changes are expected.

## Package Roles

- `src/`: Electron + TanStack router app

## Expectations

- Use dark mode color scheme, Linear-like design.
- Keep designs simple, no over explaining, plain colors, no gradients, no decorative elements.
- Assume dev servers are already running.
- Reference t3code implementation where relevant in agent loop and infrastructure.

## References

- Skills: use ~/.agents/skills/find-skills to locate relevant skills wherever possible
- SDK infrastructure: ~/code/oss/t3code
