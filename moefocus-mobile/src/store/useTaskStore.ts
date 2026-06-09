// ===== 任务库 Store =====
import { create } from 'zustand'
import { DatabaseService } from '../services/DatabaseService'
import type { Task } from '../types/models'

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
    const rows = await DatabaseService.get_all<Task>(
      'SELECT * FROM tasks WHERE is_active = 1 ORDER BY sort_order'
    )
    set({ tasks: rows, loading: false })
  },

  add_task: async (title) =>
  {
    await DatabaseService.run(
      'INSERT INTO tasks (title) VALUES (?)', [title]
    )
    await get().load_tasks()
  },

  remove_task: async (id) =>
  {
    await DatabaseService.run(
      "UPDATE tasks SET is_active = 0 WHERE id = ?", [id]
    )
    set({ tasks: get().tasks.filter((t) => t.id !== id) })
  }
}))
