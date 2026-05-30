import { MoeButton } from '../common/MoeButton'
import styles from './TimerControls.module.css'

interface Props
{
  phase: 'focus' | 'rest' | 'idle' | 'paused'
  on_start: () => void
  on_pause: () => void
  on_resume: () => void
  on_stop: () => void
}

export function TimerControls({
  phase,
  on_start,
  on_pause,
  on_resume,
  on_stop,
  on_skip
}: Props): JSX.Element
{
  return (
    <div className={styles.controls}>
      {phase === 'idle' && (
        <MoeButton variant="primary" size="lg" onClick={on_start}>
          开始专注
        </MoeButton>
      )}

      {(phase === 'focus' || phase === 'rest') && (
        <>
          <MoeButton variant="secondary" size="md" onClick={on_pause}>
            暂停
          </MoeButton>
          <MoeButton
            variant="ghost"
            size="md"
            onClick={on_stop}
            style={{ color: '#FF6B6B' }}
          >
            结束
          </MoeButton>
        </>
      )}

      {phase === 'paused' && (
        <>
          <MoeButton variant="primary" size="md" onClick={on_resume}>
            继续
          </MoeButton>
          <MoeButton variant="ghost" size="md" onClick={on_stop}>
            结束
          </MoeButton>
        </>
      )}
    </div>
  )
}
