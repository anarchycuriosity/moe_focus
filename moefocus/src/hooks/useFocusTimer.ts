// ===== Phase 3: 专注计时器 Hook (ref-based to avoid stale closure) =====
import { useRef } from 'react'
import { useFocusStore } from '../store/useFocusStore'
import dayjs from 'dayjs'

export function useFocusTimer()
{
  const interval_ref = useRef<ReturnType<typeof setInterval> | null>(null)
  const phase_end_time_ref = useRef<number | null>(null)

  const clear = () =>
  {
    if (interval_ref.current)
    {
      clearInterval(interval_ref.current)
      interval_ref.current = null
    }
    phase_end_time_ref.current = null
  }

  const arm_timer = (remaining_seconds: number) =>
  {
    phase_end_time_ref.current = Date.now() + remaining_seconds * 1000
    interval_ref.current = setInterval(tick, 1000)
  }

  const tick = () =>
  {
    const s = useFocusStore.getState()
    const phase_end_time = phase_end_time_ref.current
    const remaining = phase_end_time
      ? Math.max(0, Math.ceil((phase_end_time - Date.now()) / 1000))
      : s.remaining_seconds

    if (remaining <= 0)
    {
      clear()
      s.tick(0)
      finish_phase()
    }
    else
    {
      s.tick(remaining)
    }
  }

  const finish_phase = async () =>
  {
    const s = useFocusStore.getState()
    if (s.phase === 'focus')
    {
      if (s.session_id)
      {
        const actual = s.total_seconds - s.remaining_seconds
        await window.electronAPI.focus.complete(s.session_id, actual || s.total_seconds)
      }
      s.end_session()
      new Notification('专注完成！', { body: s.subject || '未命名' })
    }
  }

  const start = async () =>
  {
    clear()
    const s = useFocusStore.getState()
    const today = dayjs().format('YYYY-MM-DD')

    const session = await window.electronAPI.focus.start({
      subject: s.subject || '专注',
      planned_duration_min: s.focus_duration_min,
      rest_duration_sec: s.rest_duration_min * 60,
      date: today
    })
    s.start_session(session.id)
    arm_timer(useFocusStore.getState().remaining_seconds)
  }

  const pause = async () =>
  {
    clear()
    const s = useFocusStore.getState()
    const actual = s.total_seconds - s.remaining_seconds
    if (s.session_id) await window.electronAPI.focus.complete(s.session_id, actual > 0 ? actual : 0)
    s.pause_session()
  }

  const resume = async () =>
  {
    const s = useFocusStore.getState()
    const today = dayjs().format('YYYY-MM-DD')
    const remaining_min = Math.max(1, Math.ceil(s.remaining_seconds / 60))

    const session = await window.electronAPI.focus.start({
      subject: s.subject || '专注',
      planned_duration_min: remaining_min,
      rest_duration_sec: 0,
      date: today
    })
    s.continue_session(session.id)
    arm_timer(useFocusStore.getState().remaining_seconds)
  }

  const stop = async () =>
  {
    clear()
    const s = useFocusStore.getState()
    if (s.session_id && s.phase !== 'paused') await window.electronAPI.focus.abandon(s.session_id, 0)
    s.reset()
  }

  return { start, pause, resume, stop }
}
