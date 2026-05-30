// ===== 专注计时 Store =====
import { create } from 'zustand'
import { DatabaseService } from '../services/DatabaseService'
import dayjs from 'dayjs'

export type TimerPhase = 'idle' | 'focus' | 'rest' | 'paused'

interface FocusState
{
  session_id: number | null
  phase: TimerPhase
  focus_duration_min: number
  rest_duration_min: number
  remaining_seconds: number
  total_seconds: number
  subject: string
}

interface FocusStore extends FocusState
{
  set_config: (focus_min: number, rest_min: number) => void
  set_subject: (s: string) => void
  start_session: (id: number) => void
  pause_session: () => void
  resume_session: () => void
  tick: (remaining: number) => void
  switch_to_rest: () => void
  end_session: () => void
}

const initial: FocusState = {
  session_id: null,
  phase: 'idle',
  focus_duration_min: 25,
  rest_duration_min: 5,
  remaining_seconds: 25 * 60,
  total_seconds: 25 * 60,
  subject: ''
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  ...initial,

  set_config: (fm, rm) =>
  {
    set({
      focus_duration_min: fm, rest_duration_min: rm,
      remaining_seconds: fm * 60, total_seconds: fm * 60
    })
  },

  set_subject: (s) => set({ subject: s }),

  start_session: (id) =>
  {
    const total = get().focus_duration_min * 60
    set({ session_id: id, phase: 'focus', remaining_seconds: total, total_seconds: total })
  },

  pause_session: () => set({ phase: 'paused' }),
  resume_session: () => set({ phase: 'focus' }),

  tick: (r) => set({ remaining_seconds: r }),

  switch_to_rest: () =>
  {
    const total = get().rest_duration_min * 60
    set({ phase: 'rest', remaining_seconds: total, total_seconds: total })
  },

  end_session: () => set({ ...initial })
}))

// Timer control functions
export async function save_focus_complete(session_id: number, actual_sec: number): Promise<void>
{
  await DatabaseService.run(
    "UPDATE focus_sessions SET status = 'completed', actual_duration_sec = ?, ended_at = datetime('now') WHERE id = ?",
    [actual_sec, session_id]
  )
}

export async function save_focus_abandon(session_id: number): Promise<void>
{
  await DatabaseService.run(
    "UPDATE focus_sessions SET status = 'abandoned', ended_at = datetime('now') WHERE id = ?",
    [session_id]
  )
}

export async function create_focus_session(subject: string, planned_min: number, rest_sec: number): Promise<number>
{
  const today = dayjs().format('YYYY-MM-DD')
  return DatabaseService.run(
    `INSERT INTO focus_sessions (subject, planned_duration_min, rest_duration_sec, date, status)
     VALUES (?, ?, ?, ?, 'running')`,
    [subject, planned_min, rest_sec, today]
  )
}
