import { MoeButton } from '../common/MoeButton'
import styles from './TimerControls.module.css'

interface Props
{
  phase: 'focus' | 'rest' | 'idle' | 'paused' | 'completed'
  on_start: () => void
  on_pause: () => void
  on_reset: () => void
}

export function TimerControls({
  phase,
  on_start,
  on_pause,
  on_reset
}: Props): JSX.Element
{
  return (
    <div className={styles.controls}>
      {(phase === 'idle' || phase === 'completed') && (
        <MoeButton variant="primary" size="lg" onClick={on_start}>
          开始专注
        </MoeButton>
      )}

      {(phase === 'focus' || phase === 'rest') && (
        <>
          <MoeButton variant="secondary" size="md" onClick={on_pause}>
            暂停
          </MoeButton>
          <MoeButton variant="ghost" size="md" onClick={on_reset}>
            重置
          </MoeButton>
        </>
      )}
    </div>
  )
}
