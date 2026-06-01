import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusStore } from '../../store/useFocusStore'
import { MoeCard } from '../common/MoeCard'
import styles from './DailyFocusRing.module.css'

export function DailyFocusRing(): JSX.Element
{
  const [daily_goal_min, set_daily_goal_min] = useState(120)
  const [accumulated_sec, set_accumulated_sec] = useState(0)
  const [editing, set_editing] = useState(false)
  const [edit_value, set_edit_value] = useState('120')
  const input_ref = useRef<HTMLInputElement>(null)
  const phase = useFocusStore((s) => s.phase)

  const today_str = () => new Date().toISOString().slice(0, 10)

  const fetch_today = useCallback(async () =>
  {
    const sessions = await window.electronAPI.focus.get_by_date(today_str())
    const total = sessions
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + s.actual_duration_sec, 0)
    set_accumulated_sec(total)
  }, [])

  useEffect(() =>
  {
    window.electronAPI.settings.get('focus.dailyGoal').then((val) =>
    {
      const goal = val ? parseInt(val, 10) : 120
      if (goal > 0)
      {
        set_daily_goal_min(goal)
        set_edit_value(String(goal))
      }
    })
    fetch_today()
  }, [fetch_today])

  useEffect(() =>
  {
    if (phase === 'completed' || phase === 'paused')
    {
      fetch_today()
    }
  }, [phase, fetch_today])

  useEffect(() =>
  {
    if (editing && input_ref.current)
    {
      input_ref.current.focus()
      input_ref.current.select()
    }
  }, [editing])

  const save_goal = async (val: number) =>
  {
    if (val >= 1 && val <= 1440)
    {
      set_daily_goal_min(val)
      set_edit_value(String(val))
      await window.electronAPI.settings.set('focus.dailyGoal', val)
    }
    else
    {
      set_edit_value(String(daily_goal_min))
    }
    set_editing(false)
  }

  const progress = daily_goal_min > 0
    ? Math.min(accumulated_sec / (daily_goal_min * 60), 1.0)
    : 0

  const size = 130
  const stroke_width = 5
  const radius = (size - stroke_width) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference * (1 - progress)

  const acc_h = Math.floor(accumulated_sec / 3600)
  const acc_m = Math.floor((accumulated_sec % 3600) / 60)
  const acc_str = acc_h > 0 ? `${acc_h}h ${acc_m}m` : `${acc_m}m`

  const is_full = progress >= 1.0
  const ring_color = is_full ? 'var(--moe-mint)' : 'var(--moe-lavender)'

  return (
    <MoeCard className={styles.card}>
      <h3 className={styles.title}>今日总计时</h3>
      <div className={styles.ring_area}>
        <svg
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--moe-border)"
            strokeWidth={stroke_width}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ring_color}
            strokeWidth={stroke_width}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease',
              filter: accumulated_sec > 0
                ? `drop-shadow(0 0 4px ${ring_color})`
                : 'none'
            }}
          />
        </svg>

        <div className={styles.center}>
          {editing ? (
            <input
              ref={input_ref}
              type="number"
              className={styles.goal_input}
              value={edit_value}
              min={1}
              max={1440}
              onChange={(e) => set_edit_value(e.target.value)}
              onBlur={() =>
              {
                const val = parseInt(edit_value, 10)
                save_goal(isNaN(val) ? daily_goal_min : val)
              }}
              onKeyDown={(e) =>
              {
                if (e.key === 'Enter')
                {
                  const val = parseInt(edit_value, 10)
                  save_goal(isNaN(val) ? daily_goal_min : val)
                }
                if (e.key === 'Escape')
                {
                  set_edit_value(String(daily_goal_min))
                  set_editing(false)
                }
              }}
            />
          ) : (
            <span
              className={styles.goal_display}
              onClick={() => set_editing(true)}
              title="点击修改每日目标"
            >
              {daily_goal_min} 分钟
            </span>
          )}
          <span className={styles.goal_label}>每日目标</span>
        </div>
      </div>

      <div className={styles.accumulated}>
        已专注: {acc_str}
      </div>
    </MoeCard>
  )
}
