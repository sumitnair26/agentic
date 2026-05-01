import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new Anthropic();

// System prompt: role + output contract + example
const SYSTEM_PROMPT = `You are a travel booking parser. Your only job is to extract structured data from booking requests.

Return a JSON object with exactly these fields:
- "intent": the booking action (e.g. "book_flight", "check_availability")
- "origin": departure city
- "destination": arrival city
- "date": travel date, preserving the user's phrasing (e.g. "next Friday", "December 25")
- "passengers": number of travelers as an integer

Rules:
- Output ONLY the raw JSON object — no markdown, no explanation, no extra text
- If a field cannot be determined, use null
- Normalize city names to title case

Example output:
{"intent":"book_flight","origin":"Mumbai","destination":"Delhi","date":"next Friday","passengers":2}`;

interface BookingInfo {
  intent: string | null;
  origin: string | null;
  destination: string | null;
  date: string | null;
  passengers: number | null;
}

// JSON schema for the structured output — guarantees valid JSON with exact keys
const BOOKING_SCHEMA = {
  type: "object",
  properties: {
    intent:      { type: "string" },
    origin:      { type: "string" },
    destination: { type: "string" },
    date:        { type: "string" },
    passengers:  { type: "integer" },
  },
  required: ["intent", "origin", "destination", "date", "passengers"],
  additionalProperties: false,
};

async function extractBookingInfo(userMessage: string): Promise<BookingInfo> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",  // Haiku: fast + cheap for extraction; supports temperature
    max_tokens: 256,
    temperature: 0,             // Deterministic output — critical for structured extraction
    system: SYSTEM_PROMPT,
    // output_config enforces the schema server-side, eliminating markdown wrapping
    output_config: {
      format: { type: "json_schema", schema: BOOKING_SCHEMA },
    },
    messages: [
      {
        role: "user",
        // XML tags help the model distinguish input data from instructions
        content: `<booking_request>
${userMessage}
</booking_request>`,
      },
    ],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return JSON.parse(raw) as BookingInfo;
}

// --- Demo ---

const testCases = [
  "I need to book a flight from Mumbai to Delhi next Friday for 2 people",
  "Can you get me a one-way ticket from New York to London on December 25 for just me?",
  "Book three seats from Bangalore to Hyderabad tomorrow morning",
];

(async () => {
  for (const message of testCases) {
    console.log("Input:  ", message);
    try {
      const result = await extractBookingInfo(message);
      console.log("Output: ", JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("Parse error:", err);
    }
    console.log("---");
  }
})();
