---
name: argus-run
description: Use when work needs persistent multi-step execution, independent review, resumable project state, or long-running research and engineering coordination through Argus.
---

# Run With Argus

Use the installed Argus MCP tools. Do not imitate the Argus roles in the host
session and do not write Argus state files directly.

1. Call `argus_project_list` with the exact current work directory.
2. Reuse the most recently active exact-workdir project when one exists;
   otherwise call `argus_project_create` with that directory and a concise name.
3. Call `argus_message` with the user's complete objective. Manager owns chat
   versus task routing, lifetime, workflow, domain, and execution handoff.
4. Report the project ID and whether the turn was handled inline or dispatched.
5. For dispatched work, stop the current turn. Do not create an unchanged polling
   loop; use the `argus-status` Skill when status is requested.

If the MCP server is unavailable, run `argus --doctor` and report the exact
installation or backend failure. Do not silently replace Argus with an ad hoc
single-agent workflow.

Never claim completion from dispatch, daemon activity, loss, or intermediate
artifacts. Argus completion comes from its persisted Reviewer/Manager state.
