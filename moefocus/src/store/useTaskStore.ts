import { create } from 'zustand'

interface TaskStore
{
  tasks: Task[]
  loading: boolean
  load_tasks: () => Promise<void>
  add_task: (title: string, category?: string) => Promise<void>
  remove_task: (id: number) => Promise<void>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  load_tasks: async () =>
  {
    set({ loading: true })
    const tasks = await window.electronAPI.tasks.get_all()
    set({ tasks, loading: false })
  },

  add_task: async (title, category) =>
  {
    const task = await window.electronAPI.tasks.create({ title, category })
    if (task)
    {
      set({ tasks: [...get().tasks, task] })
    }
  },

  remove_task: async (id) =>
  {
    await window.electronAPI.tasks.remove(id)
    set({ tasks: get().tasks.filter((t) => t.id !== id) })
  }
}))
