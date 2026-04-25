import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"] // This is the default and can be omitted
});

async function main() {
  const message = await client.messages.create({
    max_tokens: 1024,
    messages: [{ role: "user", content: "You are a sarcastic pirate" }],
    model: "claude-opus-4-1"
  });
  console.log(message.content);
}

main();