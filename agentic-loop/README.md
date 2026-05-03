# Agentic Loop

## What Is an Agentic Loop?

An **agentic loop** is the pattern where a model doesn't just respond once — it acts, observes the result of that action, and decides what to do next, repeating until the goal is reached.

The loop has three beats:

```
Think → Act → Observe → Think → Act → Observe → ... → Done
```

Each iteration, the model:
1. Receives a prompt that includes the current state (original goal + history of what happened so far)
2. Decides on the next action (call a tool, produce output, or stop)
3. Gets the result of that action back as new context
4. Repeats

The model itself doesn't loop — **your code loops**. You are the runtime. You call the API, execute whatever tool the model asked for, append the result to the conversation, and call the API again.

---

## The Mental Model

Think of the model as a stateless function:

```
next_action = model(goal + history_so_far)
```

It has no memory between calls. All state lives in the message history you pass in. The "loop" is just you calling this function repeatedly, feeding the output of one turn as input to the next.

This means:
- The model can handle arbitrarily long tasks — each step is just one API call
- The model can correct mistakes — if a tool returns an error, the model sees it and can try differently
- The model can plan and re-plan — it can decompose a goal into steps and adapt as it learns more

---

## How It Differs from Single-Turn Tool Use

| | Single-turn tool use | Agentic loop |
|---|---|---|
| **Calls** | One API call, multiple tools | Many API calls, tools between each |
| **Scope** | Answer a question with lookups | Complete a multi-step task |
| **Error handling** | Model can retry within one turn | Model observes failure, re-strategizes across turns |
| **State** | Tool results stay in one response | History accumulates across turns |
| **Termination** | When the response is done | When the model decides the goal is met (or you set a cap) |

In single-turn tool use, the model calls tools as part of building one response. That response ends and the interaction is over.

In an agentic loop, reaching the end of one response is just the end of one step. You check whether the model signaled it's done (e.g., no tool calls, a special stop signal, or a final answer). If not, you continue the loop.

---

## The Minimal Loop (Pseudocode)

```typescript
const messages = [{ role: "user", content: goal }];

while (true) {
  const response = await client.messages.create({ model, tools, messages });

  // Model is done — no more tool calls
  if (response.stop_reason === "end_turn") {
    console.log(finalAnswer(response));
    break;
  }

  // Model wants to use a tool
  const toolUse = extractToolUse(response);
  const toolResult = await executeTool(toolUse);

  // Feed the action and its result back into history
  messages.push({ role: "assistant", content: response.content });
  messages.push({ role: "user", content: [toolResult] });
}
```

The key insight: **the loop, the tool execution, and the history management are all your responsibility**. The model just says what it wants to do next.

---

## Why This Matters

Single-turn tool use is powerful for answering questions. But many real tasks can't be expressed as "answer this question":

- Write a file, run the tests, fix what broke, repeat
- Search the web, read results, search again based on what you found
- Draft code, check if it compiles, revise

These tasks require the model to act in the world, see what happened, and adapt. That's what an agentic loop enables.

The tradeoff is that loops are harder to reason about — they can run indefinitely, accumulate errors, or go in circles. Good agentic systems add guardrails: max iteration caps, explicit done signals, and human-in-the-loop checkpoints for irreversible actions.

---

## Example: `research-agent.ts`

[research-agent.ts](research-agent.ts) is a working implementation of this pattern. Given a topic, the agent autonomously searches, reads pages, saves notes, and writes a Markdown report — deciding on its own how many steps it needs.

### Tools

| Tool | Purpose |
|---|---|
| `search(query)` | Returns 5 results (title, url, snippet) for a query |
| `get_page(url)` | Fetches the full content of a URL |
| `save_note(note)` | Appends a key finding to an in-memory notes array |
| `write_report(content)` | Writes a Markdown file to disk and signals the loop to stop |

`write_report` doubles as the **done signal** — when the model calls it, the loop terminates. This is a clean pattern: instead of inspecting `stop_reason === "end_turn"`, you let the model call a specific tool to declare completion.

### Loop structure

```
researchAgent(topic)
│
└─ while (!reportWritten)
     │
     ├─ client.messages.create(messages)   ← one API call per iteration
     │
     ├─ stop_reason === "end_turn"  → model gave up (no report), break
     ├─ stop_reason !== "tool_use"  → unexpected, break
     │
     └─ for each tool_use block:
          ├─ executeTool(name, input)       ← your code runs the tool
          ├─ collect ToolResultBlockParam
          └─ if name === "write_report" → reportWritten = true
     │
     └─ messages.push(assistant turn + tool results) → next iteration
```

Key things to notice in the code:

- **Both sides of the conversation are appended each turn** — the assistant's full `response.content` (which may include text + tool calls) and then a `user` message containing all `tool_result` blocks. Skipping either breaks the history contract.
- **Multiple tool calls per turn are handled** — the model may call `search` and `save_note` in the same response. All results are collected before the next API call ([research-agent.ts:209-232](research-agent.ts#L209-L232)).
- **`write_report` is detected inside the tool loop, not after** — `reportWritten` is set while iterating tool calls, so the result is still appended to history before the loop exits ([research-agent.ts:227-229](research-agent.ts#L227-L229)).

### Run it

```bash
cd agentic-loop
npx tsx research-agent.ts "Compare Fastify vs Express.js for Node.js APIs"
```

Pass any topic as the first argument. The agent writes a `report_<timestamp>.md` file when done.
