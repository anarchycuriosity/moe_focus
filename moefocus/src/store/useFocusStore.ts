// ===== Phase 3: 专注计时状态管理 =====
// 管理计时器状态机：idle → focus → rest → paused → idle
// 存储会话配置 (时长/主题) 和实时倒计时秒数

import { create } from 'zustand'

export type TimerPhase = 'idle' | 'focus' | 'rest' | 'paused' | 'completed'

interface FocusState
{
  session_id: number | null
  phase: TimerPhase
  focus_duration_min: number
  rest_duration_min: number
  remaining_seconds: number
  total_seconds: number
  subject: string
  todo_id: number | null
}

interface FocusStore extends FocusState
{
  set_config: (focus_min: number, rest_min: number) => void
  set_subject: (subject: string) => void
  set_todo_id: (id: number | null) => void
  start_session: (session_id: number) => void
  pause_session: () => void
  resume_session: () => void
  tick: (remaining: number) => void
  switch_to_rest: () => void
  end_session: () => void
  reset: () => void
}

const initial_state: FocusState = {
  session_id: null,
  phase: 'idle',
  focus_duration_min: 25,
  rest_duration_min: 5,
  remaining_seconds: 25 * 60,
  total_seconds: 25 * 60,
  subject: '',
  todo_id: null
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  ...initial_state,

  set_config: (focus_min, rest_min) =>
  {
    const total = focus_min * 60
    set({
      focus_duration_min: focus_min,
      rest_duration_min: rest_min,
      remaining_seconds: total,
      total_seconds: total
    })
  },

  set_subject: (subject) => set({ subject }),
  set_todo_id: (todo_id) => set({ todo_id }),

  start_session: (session_id) =>
  {
    const total = get().focus_duration_min * 60
    set({
      session_id,
      phase: 'focus',
      remaining_seconds: total,
      total_seconds: total
    })
  },

  pause_session: () => set({ phase: 'paused' }),

  resume_session: () =>
  {
    const { remaining_seconds, total_seconds } = get()
    set({
      phase: remaining_seconds === total_seconds ? 'focus' : 'focus'
    })
  },

  tick: (remaining) => set({ remaining_seconds: remaining }),

  switch_to_rest: () =>
  {
    const total = get().rest_duration_min * 60
    set({
      phase: 'rest',
      remaining_seconds: total,
      total_seconds: total
    })
  },

  end_session: () => set({ phase: 'completed', remaining_seconds: 0 }),

  reset: () => set({ ...initial_state })
}))
