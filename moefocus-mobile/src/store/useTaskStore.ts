// ===== 任务库 Store =====
import { create } from 'zustand'
import { DatabaseService } from '../services/DatabaseService'

interface TaskStore
{
  tasks: Task[]
  loading: boolean
  load_tasks: () => Promise<void>
  add_task: (title: string) => Promise<void>
  remove_task: (id: number) => Promise<void>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  load_tasks: async () =>
  {
    set({ loading: true })
    const rows = await DatabaseService.get_all(
      'SELECT * FROM tasks WHERE is_active = 1 ORDER BY sort_order'
    )
    set({ tasks: rows as unknown as Task[], loading: false })
  },

  add_task: async (title) =>
  {
    const last_id = await DatabaseService.run(
      'INSERT INTO tasks (title) VALUES (?)', [title]
    )
    const row = await DatabaseService.get_one(
      'SELECT * FROM tasks WHERE id = ?', [last_id]
    )
    if (row) set({ tasks: [...get().tasks, row as unknown as Task] })
  },

  remove_task: async (id) =>
  {
    await DatabaseService.run(
      "UPDATE tasks SET is_active = 0 WHERE id = ?", [id]
    )
    set({ tasks: get().tasks.filter((t) => t.id !== id) })
  }
}))
