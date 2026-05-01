# Prompting Techniques

These 5 techniques cover 90% of what you'll use when building AI apps. Click any to learn more.

## 01 Chain-of-thought (CoT)

Tell the model to "think step by step" before answering. Dramatically improves accuracy on reasoning, math, and logic tasks. Essential for agents that need to plan.

| Without CoT | With CoT |
|---|---|
| "What is 15% of 340?" → "51" (sometimes wrong) | "Think step by step. What is 15% of 340?" → reasons correctly → "51" |

## 02 Few-shot prompting

Give 2–5 examples of input → output pairs in the prompt. The model learns your desired format and style from the examples instead of just instructions.

| Zero-shot (fragile) | Few-shot (reliable) |
|---|---|
| "Classify this email as spam or not spam." → inconsistent format | Input: "Buy now!!!" → spam  Input: "Meeting at 3pm" → not_spam  Input: [new email] → ? |

## 03 Structured output (JSON)

Ask the model to return a specific JSON schema. Makes LLM output easy to parse and use in your Node.js app. The backbone of every tool-use integration.

## 04 XML tags for structure

Anthropic models respond especially well to XML tags like `<context>`, `<instructions>`, `<example>`. Use them to separate distinct parts of complex prompts.

## 05 Role prompting

Give the model an identity: "You are a senior Node.js engineer who only responds with working code." Anchors behavior across the entire conversation reliably.
