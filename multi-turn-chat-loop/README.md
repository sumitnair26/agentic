# Multi-Turn Chat Loop

An interactive terminal chatbot using the Anthropic SDK that demonstrates how to maintain conversation context across multiple turns.

## The Core Concept

The Anthropic API is **stateless** — it has no memory of previous requests. To simulate a conversation, the client maintains a `history` array and sends the full message history on every API call. Each call appends the user's message before sending and appends Claude's reply after receiving it.

```
history = [
  { role: "user",      content: "Hi, my name is Sumit." },
  { role: "assistant", content: "Hello Sumit! How can I help?" },
  { role: "user",      content: "What's my name?" },   ← sent with all prior turns
]
```

## Setup

Install dependencies from the repo root first if you haven't already:

```bash
# From repo root — ensure .env exists with your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > ../.env

# Install dependencies
npm install
```

## Run

```bash
npx tsx chat-loop.ts
```

## Usage

```
Chat started. Type 'exit' to quit.

You: Hi, my name is Sumit.
Claude: Hello Sumit! Nice to meet you. How can I help you today?

You: What's my name?
Claude: Your name is Sumit!

You: exit
```

Type `exit` to end the session.

## Model

Uses `claude-haiku-4-5` — the fastest and most cost-efficient Claude model, well-suited for interactive chat.
