import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import * as path from "path";
import * as https from "https";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new Anthropic();

// ── Tool definitions ─────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description:
      "Get the current weather conditions for a city. Returns temperature, humidity, wind speed, and a short description.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: {
          type: "string",
          description: "City name, e.g. 'Pune' or 'London'",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "get_forecast",
    description:
      "Get a 3-day weather forecast for a city. Returns daily high/low temperatures and conditions for the next 3 days.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: {
          type: "string",
          description: "City name, e.g. 'Pune' or 'London'",
        },
      },
      required: ["city"],
    },
  },
];

// ── wttr.in helpers ──────────────────────────────────────────────────────────

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "weather-agent/1.0" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${data.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function get_weather(city: string): Promise<string> {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  const data = await fetchJson(url);
  const c = data.current_condition[0];
  return JSON.stringify({
    city,
    temperature_C: Number(c.temp_C),
    feels_like_C: Number(c.FeelsLikeC),
    humidity_pct: Number(c.humidity),
    wind_kmph: Number(c.windspeedKmph),
    wind_direction: c.winddir16Point,
    description: c.weatherDesc[0].value.trim(),
    visibility_km: Number(c.visibility),
  });
}

async function get_forecast(city: string): Promise<string> {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  const data = await fetchJson(url);
  const days = data.weather.slice(0, 3).map((day: any) => ({
    date: day.date,
    max_C: Number(day.maxtempC),
    min_C: Number(day.mintempC),
    avg_C: Number(day.avgtempC),
    description: day.hourly[4]?.weatherDesc[0]?.value.trim() ?? "N/A",
    chance_of_rain_pct: Number(day.hourly[4]?.chanceofrain ?? 0),
    uv_index: Number(day.uvIndex),
  }));
  return JSON.stringify({ city, forecast: days });
}

// ── Tool dispatcher ──────────────────────────────────────────────────────────

async function dispatchTool(
  name: string,
  input: Record<string, string>
): Promise<string> {
  console.log(`  → calling ${name}(city="${input.city}")`);
  if (name === "get_weather") return get_weather(input.city);
  if (name === "get_forecast") return get_forecast(input.city);
  throw new Error(`Unknown tool: ${name}`);
}

// ── Agentic loop ─────────────────────────────────────────────────────────────

async function run(userMessage: string) {
  console.log(`\nUser: ${userMessage}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5", // Haiku: fast + cheap for tool use; supports temperature
      max_tokens: 1024,
      tools,
      messages,
    });

    // Collect any text the model produced this turn
    const textBlocks = response.content.filter((b) => b.type === "text");
    if (textBlocks.length > 0) {
      for (const block of textBlocks) {
        if (block.type === "text") process.stdout.write(block.text);
      }
    }

    // No tool calls → model is done
    if (response.stop_reason === "end_turn") {
      console.log("\n");
      break;
    }

    // Handle tool_use blocks
    const toolUseBlocks = response.content.filter(
      (b) => b.type === "tool_use"
    );
    if (toolUseBlocks.length === 0) break;

    // Push the assistant turn (may include text + tool_use blocks)
    messages.push({ role: "assistant", content: response.content });

    // Execute every tool call and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        if (block.type !== "tool_use") throw new Error("unexpected");
        try {
          const result = await dispatchTool(
            block.name,
            block.input as Record<string, string>
          );
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: result,
          };
        } catch (err: any) {
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: `Error: ${err.message}`,
            is_error: true,
          };
        }
      })
    );

    // Feed all results back in a single user turn
    messages.push({ role: "user", content: toolResults });
  }
}

// ── Demo queries ─────────────────────────────────────────────────────────────

(async () => {
  // Round 1: current weather → model should pick get_weather
  await run("What's the weather like in Jabalpur right now?");

  // Round 2: weekly outlook → model should pick get_forecast
  await run("What's the weather in Pune this week?");
})();
