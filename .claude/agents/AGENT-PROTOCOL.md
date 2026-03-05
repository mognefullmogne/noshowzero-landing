# Agent Protocol — Context Survival System

> Every agent MUST follow this protocol. It keeps you functional across context compactions.

## 1. On Session Start (ALWAYS do this first)

```
1. Read THIS file: .claude/agents/AGENT-PROTOCOL.md
2. Read YOUR state file: .claude/agents/[your-name]-state.md
3. Read the handoff: HANDOFF.md
4. Resume exactly where your state file says you left off
```

## 2. Checkpoint Protocol (MANDATORY)

Write to your state file `.claude/agents/[your-name]-state.md` at these moments:
- **After completing each task** (before picking up the next one)
- **After every 5-10 tool calls** (don't wait too long)
- **Before any risky operation** (deployments, large refactors)

Your state file format:

```markdown
# [Agent Name] State

> Last checkpoint: YYYY-MM-DD HH:MM

## Identity
- Role: [your role in one line]
- Model: [opus/sonnet/haiku]

## Currently Working On
[Exact task, file, line number — be specific]

## Completed This Session
- [task 1]
- [task 2]

## Next Up
- [what to do after current task]

## Key Context
[Anything you need to remember that isn't in HANDOFF.md]
[File paths, decisions made, gotchas discovered]

## Files I Own
- [file paths you claimed]
```

## 3. After Context Compaction

When you notice your context was compacted (conversation feels shorter, earlier messages missing):
1. **STOP** whatever you're doing
2. Read `.claude/agents/AGENT-PROTOCOL.md` (this file)
3. Read `.claude/agents/[your-name]-state.md`
4. **Resume from your state file** — don't restart from scratch

## 4. Rules for All Agents

- HANDOFF.md is the source of truth for project context and next steps
- Your state file is YOUR personal memory — only you write to it
- Never edit another agent's state file
- If you don't know what to do, re-read HANDOFF.md "What To Do Next" section
- If your task is done, update your state file, then check for next task
- Always run `npx next build && npx vitest run` after code changes
- Project path: /Users/aiassistant/products/noshowzero-landing
