# Tool Use

## What is tool use?

The model can't browse the web, query a database, or call your APIs by itself. Tool use lets it *ask your Node.js app* to do those things — then reason over the result.

> **Your Node.js instinct:** think of it as the model making a function call request. Your app receives the call, executes the real function, and sends the result back. The model then uses that result to form its final answer.

## The tool use flow

1. **You define tools** — Describe each tool as a JSON schema (name, description, and parameters). You send these alongside the user message.

2. **Model decides to call a tool** — Instead of a text reply, the model returns `stop_reason: "tool_use"` with the tool name and arguments it wants to use.

3. **You execute the tool** — Your Node.js code calls the actual function (fetch weather API, query DB, etc.) and gets a real result.

4. **You send the result back** — You append the tool result to the conversation as a `tool_result` content block and call the API again.

5. **Model composes its final answer** — Now with real data in hand, the model composes its final response to the user. `stop_reason: "end_turn"`

## Example: defining a tool

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a given city.",
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "The city name, e.g. 'San Francisco'",
        },
      },
      required: ["city"],
    },
  },
];
```

## Example: handling the tool call

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  tools,
  messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
});

if (response.stop_reason === "tool_use") {
  const toolUse = response.content.find((b) => b.type === "tool_use");
  const result = await getWeather(toolUse.input.city); // your real function

  // Send result back
  const final = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    tools,
    messages: [
      { role: "user", content: "What's the weather in Tokyo?" },
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          },
        ],
      },
    ],
  });

  console.log(final.content);
}
```

## Tips & pitfalls

- **Always echo back the full assistant turn** before appending `tool_result` — the API requires it.
- **Multiple tools can be called in one turn** — check for all `tool_use` blocks, not just the first.
- **Tool descriptions matter** — the model decides *which* tool to call based on your description. Be specific.
- **Validate inputs** — the model constructs arguments from context; treat them like untrusted user input.
- **Handle `stop_reason: "end_turn"` without tool calls** — the model may answer directly if it doesn't need a tool.

## The agent loop

For multi-step tasks, wrap the flow in a loop and keep processing tool calls until `stop_reason` is `"end_turn"`:

```typescript
while (response.stop_reason === "tool_use") {
  // execute all tool calls, collect results
  // append assistant turn + tool_result(s) to messages
  // call the API again
  response = await client.messages.create({ ... });
}
// final answer is ready
```

This is the foundation of an **agent**: a model that can take sequences of actions to complete a goal.
