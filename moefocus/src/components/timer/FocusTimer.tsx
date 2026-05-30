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

  const { start, pause, resume, stop, skip_to_rest } = useFocusTimer()

  const timer_size = expanded ? 260 : 180

  return (
    <MoeCard className={`${styles.timer} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.clock_area}>
        <CircularProgress
          remaining_seconds={remaining_seconds}
          total_seconds={total_seconds}
          size={timer_size}
          phase={phase}
        />
      </div>

      {phase !== 'idle' && subject && (
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
        on_skip={skip_to_rest}
      />
    </MoeCard>
  )
}
