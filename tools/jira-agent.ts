import Anthropic from "@anthropic-ai/sdk";
import { tools } from "./jira-tools";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new Anthropic();

// ── In-memory DB (swap with Postgres in real app) ──
let nextId = 6;
const tasks = [
  { id: 'TASK-1', title: 'Fix login bug',        status: 'open',        priority: 'high',   assignee: 'Sumit' },
  { id: 'TASK-2', title: 'Write API docs',       status: 'in_progress', priority: 'medium', assignee: 'Anjali' },
  { id: 'TASK-3', title: 'Setup CI pipeline',    status: 'open',        priority: 'high',   assignee: 'Sumit' },
  { id: 'TASK-4', title: 'Add dark mode',        status: 'open',        priority: 'low',    assignee: 'Shriyan' },
  { id: 'TASK-5', title: 'Optimise DB queries',  status: 'done',        priority: 'high',   assignee: 'Anjali' },
];

// ── Tool functions ──────────────────────────────────────
function listTasks(input: Record<string, string> = {}): object {
  const { status, assignee, priority } = input;
  let r = [...tasks];
  if (status && status !== 'all') r = r.filter(t => t.status === status);
  if (assignee) r = r.filter(t => t.assignee.toLowerCase() === assignee.toLowerCase());
  if (priority) r = r.filter(t => t.priority === priority);
  return { count: r.length, tasks: r };
}

function createTask(input: Record<string, string>): object {
  const { title, priority = 'medium', assignee = 'Unassigned' } = input;
  const task = { id: `TASK-${nextId++}`, title, priority, assignee, status: 'open' };
  tasks.push(task);
  return { success: true, task };
}

function updateTask(input: Record<string, string>): object {
  const { task_id, ...updates } = input;
  const task = tasks.find(t => t.id === task_id);
  if (!task) return { success: false, error: `${task_id} not found` };
  Object.assign(task, updates);
  return { success: true, task };
}

const toolMap: Record<string, (input: Record<string, string>) => object> = {
  list_tasks: listTasks,
  create_task: createTask,
  update_task: updateTask,
};

// ── Agent loop ──────────────────────────────────────────
async function agent(userMessage: string, maxTurns = 8): Promise<string | undefined> {
  console.log(`\n👤 ${userMessage}\n`);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  let turns = 0;

  while (turns++ < maxTurns) {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: 'You are a task management assistant. Summarise every action you took.',
      tools,
      messages,
    });

    // ── Final answer
    if (res.stop_reason === 'end_turn') {
      const textBlock = res.content.find(b => b.type === 'text');
      const text = textBlock?.type === 'text' ? textBlock.text : undefined;
      console.log(`🤖 ${text}\n`);
      return text;
    }

    // ── Tool call(s)
    if (res.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: res.content });

      const results: Anthropic.ToolResultBlockParam[] = res.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map(block => {
          console.log(`  🔧 ${block.name}(${JSON.stringify(block.input)})`);
          let content: string;
          try {
            content = JSON.stringify(toolMap[block.name](block.input as Record<string, string>));
          } catch (e) {
            content = JSON.stringify({ error: (e as Error).message });
          }
          console.log(`  📦 ${content}\n`);
          return { type: 'tool_result', tool_use_id: block.id, content };
        });

      messages.push({ role: 'user', content: results });
    }
  }
  throw new Error('Exceeded max turns');
}

// ── Test with 3 queries ─────────────────────────────────
(async () => {
  await agent('Show me all high priority open tasks');
  await agent('Create a task: Refactor auth module, high priority, assign to Anjali');
  await agent("Find Sumit's open tasks and mark them all as in-progress");
})();