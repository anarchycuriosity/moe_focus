// ===== Phase 3: 专注计时器 Hook =====
// setInterval 驱动的倒计时逻辑 (渲染进程中运行)
// 支持 start/pause/resume/stop/skip_to_rest 五个操作
// 会话结束时通过 IPC 写入 focus_sessions 表

import { useEffect, useRef, useCallback } from 'react'
import { useFocusStore } from '../store/useFocusStore'
import dayjs from 'dayjs'

export function useFocusTimer(): {
  is_running: boolean
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  skip_to_rest: () => void
}
{
  const {
    phase, remaining_seconds, total_seconds,
    focus_duration_min, rest_duration_min,
    subject, todo_id, session_id,
    start_session, pause_session, resume_session,
    tick, switch_to_rest, end_session
  } = useFocusStore()

  const interval_ref = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track actual elapsed seconds for accurate session duration
  const elapsed_ref = useRef(0)

  const clear_timer = useCallback(() =>
  {
    if (interval_ref.current !== null)
    {
      clearInterval(interval_ref.current)
      interval_ref.current = null
    }
  }, [])

  const complete_current_phase = useCallback(async () =>
  {
    clear_timer()

    if (phase === 'focus')
    {
      // Complete focus session
      if (session_id)
      {
        const actual_sec = focus_duration_min * 60 - remaining_seconds
        await window.electronAPI.focus.complete(session_id, actual_sec)
      }

      // Switch to rest
      if (rest_duration_min > 0)
      {
        switch_to_rest()
      }
      else
      {
        end_session()
        new Notification('专注完成！', { body: `主题: ${subject || '未命名'}` })
      }
    }
    else if (phase === 'rest')
    {
      end_session()
      new Notification('休息结束！', { body: '准备好下一个专注会话了吗？' })
    }
  }, [phase, session_id, focus_duration_min, rest_duration_min, remaining_seconds, subject, clear_timer, switch_to_rest, end_session])

  const run_timer = useCallback(() =>
  {
    const start_remaining = useFocusStore.getState().remaining_seconds

    interval_ref.current = setInterval(() =>
    {
      const remaining = useFocusStore.getState().remaining_seconds
      if (remaining <= 1)
      {
        useFocusStore.getState().tick(0)
        complete_current_phase()
      }
      else
      {
        useFocusStore.getState().tick(remaining - 1)
      }
    }, 1000)
  }, [complete_current_phase])

  const start = useCallback(async () =>
  {
    const state = useFocusStore.getState()
    const today = dayjs().format('YYYY-MM-DD')

    const session = await window.electronAPI.focus.start({
      todo_id: state.todo_id || undefined,
      subject: state.subject || '专注',
      planned_duration_min: state.focus_duration_min,
      rest_duration_sec: state.rest_duration_min * 60,
      date: today
    })

    start_session(session.id)
    run_timer()
  }, [start_session, run_timer])

  const pause = useCallback(async () =>
  {
    clear_timer()
    pause_session()
    if (session_id)
    {
      await window.electronAPI.focus.pause(session_id)
    }
  }, [clear_timer, pause_session, session_id])

  const resume = useCallback(async () =>
  {
    resume_session()
    if (session_id)
    {
      await window.electronAPI.focus.resume(session_id)
    }
    run_timer()
  }, [resume_session, session_id, run_timer])

  const stop = useCallback(async () =>
  {
    clear_timer()
    if (session_id)
    {
      await window.electronAPI.focus.abandon(session_id)
    }
    end_session()
  }, [clear_timer, session_id, end_session])

  const skip_to_rest = useCallback(async () =>
  {
    clear_timer()
    if (session_id)
    {
      const actual_sec = focus_duration_min * 60
      await window.electronAPI.focus.complete(session_id, actual_sec)
    }
    if (rest_duration_min > 0)
    {
      switch_to_rest()
    }
    else
    {
      end_session()
    }
  }, [clear_timer, session_id, focus_duration_min, rest_duration_min, switch_to_rest, end_session])

  // Cleanup on unmount
  useEffect(() =>
  {
    return () => clear_timer()
  }, [clear_timer])

  return {
    is_running: phase === 'focus' || phase === 'rest',
    start, pause, resume, stop, skip_to_rest
  }
}
