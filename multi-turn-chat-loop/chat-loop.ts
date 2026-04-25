import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// The API is stateless. This array IS the memory — send it in full every request.
const history: Anthropic.MessageParam[] = [];

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

async function chat(userMessage: string): Promise<string> {
  history.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: history,
  });

  const reply = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  history.push({ role: "assistant", content: reply });

  return reply;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Chat started. Type 'exit' to quit.\n");

  const ask = () => {
    rl.question("You: ", async (input) => {
      const userInput = input.trim();
      if (userInput.toLowerCase() === "exit") {
        rl.close();
        return;
      }
      if (!userInput) {
        ask();
        return;
      }

      const reply = await chat(userInput);
      console.log(`Agent: ${reply}\n`);
      ask();
    });
  };

  ask();
}

main();
