import { useEffect } from 'react'
import { useFocusStore } from '../../store/useFocusStore'
import { MoeCard } from '../common/MoeCard'
import { MoeInput } from '../common/MoeInput'
import styles from './SessionConfig.module.css'

export function SessionConfig(): JSX.Element
{
  const {
    focus_duration_min,
    rest_duration_min,
    subject,
    set_config,
    set_subject
  } = useFocusStore()

  useEffect(() =>
  {
    async function load_defaults()
    {
      const phase = useFocusStore.getState().phase
      if (phase === 'focus' || phase === 'rest' || phase === 'paused')
      {
        return
      }

      const focus_str = await window.electronAPI.settings.get('focus.defaultDuration')
      const rest_str = await window.electronAPI.settings.get('focus.defaultRestDuration')
      const focus_val = focus_str ? parseInt(focus_str, 10) : 25
      const rest_val = rest_str ? parseInt(rest_str, 10) : 5
      if (focus_val > 0 && rest_val >= 0)
      {
        set_config(focus_val, rest_val)
      }
    }
    load_defaults()
  }, [])

  return (
    <MoeCard className={styles.config}>
      <h3 className={styles.title}>会话设置</h3>
      <div className={styles.fields}>
        <MoeInput
          label="专注时长 (分钟)"
          type="number"
          value={focus_duration_min}
          min={1}
          max={120}
          onChange={(e) =>
          {
            const val = Number(e.target.value)
            if (val > 0)
            {
              set_config(val, rest_duration_min)
            }
          }}
        />
        <MoeInput
          label="休息时长 (分钟)"
          type="number"
          value={rest_duration_min}
          min={0}
          max={60}
          onChange={(e) =>
          {
            const val = Number(e.target.value)
            if (val >= 0)
            {
              set_config(focus_duration_min, val)
            }
          }}
        />
        <MoeInput
          label="专注事项"
          type="text"
          placeholder="例如：学习日语"
          value={subject}
          onChange={(e) => set_subject(e.target.value)}
        />
      </div>
    </MoeCard>
  )
}
