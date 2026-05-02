export const tools = [

  // READ: fetch tasks with optional filters
  {
    name: 'list_tasks',
    description: `Fetch tasks from the system.
Use when user wants to see, find, or list tasks.
Returns array with id, title, status, priority, assignee.
IMPORTANT: Call this first if you need task IDs before updating.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        status:   { type: 'string', enum: ['open','in_progress','done','all'] },
        assignee: { type: 'string', description: 'Filter by name' },
        priority: { type: 'string', enum: ['low','medium','high'] },
      },
      required: [],
    },
  },

  // WRITE: create a new task
  {
    name: 'create_task',
    description: `Create a new task. Use when user asks to add or create a task.
Returns the new task with its assigned ID.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        title:    { type: 'string', description: 'Short task title' },
        priority: { type: 'string', enum: ['low','medium','high'] },
        assignee: { type: 'string', description: 'Person to assign to' },
      },
      required: ['title'],
    },
  },

  // WRITE: update an existing task
  {
    name: 'update_task',
    description: `Update an existing task by ID.
You MUST have the task ID — call list_tasks first if you don't.
Returns the updated task.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id:  { type: 'string', description: 'e.g. "TASK-3"' },
        status:   { type: 'string', enum: ['open','in_progress','done'] },
        priority: { type: 'string', enum: ['low','medium','high'] },
        assignee: { type: 'string' },
      },
      required: ['task_id'],
    },
  },
];