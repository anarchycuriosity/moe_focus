// ===== TODO Store =====
import { create } from 'zustand'
import { DatabaseService } from '../services/DatabaseService'
import type { TodoItem } from '../types/models'
import dayjs from 'dayjs'

interface TodoStore
{
  items: TodoItem[]
  date: string
  loading: boolean
  load_todos: (date?: string) => Promise<void>
  add_todo: (task_id?: number, custom_title?: string) => Promise<void>
  remove_todo: (id: number) => Promise<void>
  toggle_done: (id: number) => Promise<void>
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  items: [],
  date: dayjs().format('YYYY-MM-DD'),
  loading: false,

  load_todos: async (date) =>
  {
    const target = date || get().date
    set({ loading: true, date: target })
    const rows = await DatabaseService.get_all<TodoItem>(
      `SELECT ti.*, t.title as task_title, t.color as task_color
       FROM todo_items ti
       LEFT JOIN tasks t ON ti.task_id = t.id
       WHERE ti.date = ? ORDER BY ti.sort_order`,
      [target]
    )
    set({ items: rows, loading: false })
  },

  add_todo: async (task_id, custom_title) =>
  {
    const max_row = await DatabaseService.get_one<{ max_ord: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_ord FROM todo_items WHERE date = ?',
      [get().date]
    )
    const next = ((max_row?.max_ord as number) ?? -1) + 1

    await DatabaseService.run(
      'INSERT INTO todo_items (task_id, custom_title, date, sort_order) VALUES (?, ?, ?, ?)',
      [task_id || null, custom_title || null, get().date, next]
    )
    await get().load_todos()
  },

  remove_todo: async (id) =>
  {
    await DatabaseService.run('DELETE FROM todo_items WHERE id = ?', [id])
    set({ items: get().items.filter((i) => i.id !== id) })
  },

  toggle_done: async (id) =>
  {
    const item = get().items.find((i) => i.id === id)
    if (!item) return
    const new_status = item.status === 'done' ? 'pending' : 'done'
    await DatabaseService.run(
      "UPDATE todo_items SET status = ?, completed_at = ?, updated_at = datetime('now') WHERE id = ?",
      [new_status, new_status === 'done' ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null, id]
    )
    set({
      items: get().items.map((i) =>
        i.id === id ? { ...i, status: new_status } : i
      )
    })
  }
}))
