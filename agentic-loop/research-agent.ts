import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new Anthropic();

// --- Simulated tool implementations ---

function search(query: string): string {
  const slug = query.toLowerCase().replace(/\s+/g, "-");
  const results = [
    {
      title: `${query} — Overview`,
      url: `https://example.com/${slug}/overview`,
      snippet: `A comprehensive overview of ${query}, covering key concepts and the latest developments.`,
    },
    {
      title: `${query} vs Alternatives`,
      url: `https://techblog.com/${slug}-comparison`,
      snippet: `In-depth comparison of ${query} with popular alternatives, including performance benchmarks.`,
    },
    {
      title: `Getting Started with ${query}`,
      url: `https://docs.example.com/${slug}/quickstart`,
      snippet: `Official quickstart guide and code examples for ${query}.`,
    },
    {
      title: `${query} Best Practices 2024`,
      url: `https://blog.dev/${slug}-best-practices`,
      snippet: `Community-curated best practices for using ${query} in production environments.`,
    },
    {
      title: `${query} Performance Analysis`,
      url: `https://benchmark.io/${slug}`,
      snippet: `Independent performance analysis of ${query} across various workloads.`,
    },
  ];
  return JSON.stringify(results, null, 2);
}

function get_page(url: string): string {
  const parts = url.split("/").slice(3).join(" ").replace(/-/g, " ");
  return `# Page: ${url}

## Summary
Detailed information about ${parts}.

## Key Points
1. **Performance** — Benchmarks show 2–10x improvements over older alternatives.
2. **Developer Experience** — Clean API with strong TypeScript support and great docs.
3. **Community** — 50k+ GitHub stars, 500+ contributors, 10M+ weekly downloads.
4. **Maturity** — Used by Fortune 500 companies; latest release ships monthly.

## Comparison Table
| Feature        | This Tool | Alternative A | Alternative B |
|----------------|-----------|---------------|---------------|
| Throughput     | ★★★★★    | ★★★☆☆        | ★★★★☆        |
| Ease of use    | ★★★★☆    | ★★★★★        | ★★★☆☆        |
| Ecosystem size | ★★★☆☆    | ★★★★★        | ★★★☆☆        |

## Verdict
Recommended for teams prioritizing throughput and TypeScript-first development.`;
}

const notes: string[] = [];

function save_note(note: string): string {
  notes.push(note);
  return `✓ Note saved (${notes.length} total).`;
}

function write_report(content: string): string {
  const filename = `report_${Date.now()}.md`;
  const reportPath = path.resolve(__dirname, filename);
  fs.writeFileSync(reportPath, content);
  return `✓ Report written to ${filename}`;
}

// --- Tool schema for Claude ---

const tools: Anthropic.Tool[] = [
  {
    name: "search",
    description:
      "Search the web for a query. Returns the top 5 results (title, url, snippet).",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_page",
    description: "Fetch the full content of a URL to read an article in depth.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "The URL to fetch" },
      },
      required: ["url"],
    },
  },
  {
    name: "save_note",
    description:
      "Save a key fact or finding to memory so you can reference it later.",
    input_schema: {
      type: "object" as const,
      properties: {
        note: { type: "string", description: "The fact or finding to save" },
      },
      required: ["note"],
    },
  },
  {
    name: "write_report",
    description:
      "Write the final structured research report in Markdown. Call this when you have gathered enough information — it signals that research is complete.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "Full Markdown content of the report",
        },
      },
      required: ["content"],
    },
  },
];

// --- Tool dispatcher ---

function executeTool(name: string, input: Record<string, string>): string {
  switch (name) {
    case "search":
      return search(input.query);
    case "get_page":
      return get_page(input.url);
    case "save_note":
      return save_note(input.note);
    case "write_report":
      return write_report(input.content);
    default:
      return `Unknown tool: ${name}`;
  }
}

// --- Agentic loop ---

async function researchAgent(topic: string): Promise<void> {
  console.log(`\nResearching: "${topic}"\n${"─".repeat(60)}`);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Research this topic and produce a structured report: "${topic}"

Steps:
1. Decide what to search for first.
2. Call search() with a relevant query.
3. Call get_page() on any result that looks detailed.
4. Call save_note() to record key findings.
5. Repeat until you have enough information.
6. Call write_report() with a well-structured Markdown report.

Be autonomous — decide how many searches you need.`,
    },
  ];

  let reportWritten = false;

  while (!reportWritten) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system:
        "You are a research agent. Autonomously search, read pages, save notes, and produce a structured Markdown report. You decide how many searches are needed. When satisfied, call write_report().",
      tools,
      messages,
    });

    // Append assistant turn
    messages.push({ role: "assistant", content: response.content });

    // Print any text the model emits
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        console.log("\nAgent:", block.text.trim());
      }
    }

    if (response.stop_reason === "end_turn") {
      console.log("\nAgent stopped without writing a report.");
      break;
    }

    if (response.stop_reason !== "tool_use") {
      console.log(`\nStop reason: ${response.stop_reason}`);
      break;
    }

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const input = block.input as Record<string, string>;
      console.log(`\n[${block.name}]`, JSON.stringify(input));

      const result = executeTool(block.name, input);
      const preview = result.length > 300 ? result.slice(0, 300) + "…" : result;
      console.log("→", preview);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });

      if (block.name === "write_report") {
        reportWritten = true;
      }
    }

    messages.push({ role: "user", content: toolResults });

    if (reportWritten) {
      console.log(`\n${"─".repeat(60)}\nDone. ${notes.length} notes collected.`);
    }
  }
}

// --- Entry point ---

const topic =
  process.argv[2] ?? "Compare Fastify vs Express.js for Node.js APIs";

researchAgent(topic).catch(console.error);
