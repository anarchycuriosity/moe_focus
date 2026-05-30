import { useFocusStore } from '../../store/useFocusStore'
import { useFocusTimer } from '../../hooks/useFocusTimer'
import { CircularProgress } from './CircularProgress'
import { TimerControls } from './TimerControls'
import { MoeCard } from '../common/MoeCard'
import styles from './FocusTimer.module.css'

interface Props
{
  expanded?: boolean
}

export function FocusTimer({ expanded = false }: Props): JSX.Element
{
  const {
    phase, remaining_seconds, total_seconds, subject
  } = useFocusStore()

  const { start, pause, resume, stop, reset } = useFocusTimer()

  const timer_size = expanded ? 260 : 180
  const is_active = phase === 'focus' || phase === 'rest' || phase === 'paused'

  return (
    <MoeCard className={`${styles.timer} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.clock_area}>
        {is_active ? (
          <CircularProgress
            remaining_seconds={remaining_seconds}
            total_seconds={total_seconds}
            size={timer_size}
            phase={phase}
          />
        ) : (
          <div
            style={{
              width: timer_size,
              height: timer_size,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '40px', opacity: 0.6 }}>
              {phase === 'completed' ? '🎉' : '⏱️'}
            </span>
            <span style={{ fontSize: '14px', color: 'var(--moe-text-light)' }}>
              {phase === 'completed' ? '专注完成！' : '准备开始'}
            </span>
          </div>
        )}
      </div>

      {is_active && subject && (
        <div className={styles.subject}>
          📌 {subject}
        </div>
      )}

      <TimerControls
        phase={phase}
        on_start={start}
        on_pause={pause}
        on_resume={resume}
        on_stop={stop}
        on_reset={reset}
      />
    </MoeCard>
  )
}
