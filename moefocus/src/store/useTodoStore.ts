// ===== Phase 2: TODO 状态管理 =====
// 管理今日待办列表的增删改查、排序和完成状态切换
// 所有写操作通过 IPC → 主进程 → sql.js → 磁盘持久化

import { create } from 'zustand'
import dayjs from 'dayjs'

interface TodoStore
{
  items: TodoItem[]
  date: string
  loading: boolean
  load_todos: (date?: string) => Promise<void>
  add_todo: (task_id?: number, custom_title?: string) => Promise<void>
  update_todo: (id: number, data: Partial<TodoInput>) => Promise<void>
  remove_todo: (id: number) => Promise<void>
  reorder_todos: (ids: number[]) => Promise<void>
  toggle_done: (id: number) => Promise<void>
  clear_all: () => Promise<void>
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  items: [],
  date: dayjs().format('YYYY-MM-DD'),
  loading: false,

  load_todos: async (date) =>
  {
    const target_date = date || get().date
    set({ loading: true, date: target_date })
    const items = await window.electronAPI.todos.get_by_date(target_date)
    set({ items, loading: false })
  },

  add_todo: async (task_id, custom_title) =>
  {
    console.log('[TodoStore] add_todo:', task_id, custom_title, get().date)
    const item = await window.electronAPI.todos.add({
      task_id,
      custom_title,
      date: get().date
    })
    console.log('[TodoStore] result:', item)
    if (item && item.id != null)
    {
      set({ items: [...get().items, item] })
    }
    else
    {
      console.warn('[TodoStore] IPC returned null/undefined')
    }
  },

  update_todo: async (id, data) =>
  {
    const updated = await window.electronAPI.todos.update(id, data)
    set({
      items: get().items.map((item) =>
        item.id === id ? updated : item
      )
    })
  },

  remove_todo: async (id) =>
  {
    await window.electronAPI.todos.remove(id)
    set({ items: get().items.filter((item) => item.id !== id) })
  },

  reorder_todos: async (ids) =>
  {
    await window.electronAPI.todos.reorder(ids)
    const items = get().items
    const reordered = ids.map((id) => items.find((i) => i.id === id)!).filter(Boolean)
    set({ items: reordered })
  },

  toggle_done: async (id) =>
  {
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    const new_status = item.status === 'done' ? 'pending' : 'done'
    const completed_at = new_status === 'done' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null
    await get().update_todo(id, { status: new_status, completed_at })
  },

  clear_all: async () =>
  {
    const current = get().items
    for (const item of current)
    {
      if (item && item.id != null)
      {
        await window.electronAPI.todos.remove(item.id)
      }
    }
    set({ items: [] })
  }
}))
