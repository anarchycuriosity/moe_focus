import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoeCard } from '../common/MoeCard'
import styles from './DiaryTimeline.module.css'

interface Props
{
  on_select?: () => void
}

export function DiaryTimeline({ on_select }: Props): JSX.Element
{
  const [entries, set_entries] = useState<Array<{ date: string; file_path: string | null; mood: string | null }>>([])
  const navigate = useNavigate()

  useEffect(() =>
  {
    window.electronAPI.diary.list_all().then(set_entries)
  }, [])

  const handle_click = (date: string) =>
  {
    navigate(`/diary/${date}`)
    on_select?.()
  }

  return (
    <MoeCard className={styles.timeline}>
      <h3 className={styles.title}>日记历史</h3>
      <div className={styles.list}>
        {entries.length === 0 ? (
          <p className={styles.empty}>暂无日记</p>
        ) : (
          entries.map((entry) => (
            <button
              key={entry.date}
              className={styles.entry}
              onClick={() => handle_click(entry.date)}
            >
              <span className={styles.date}>{entry.date}</span>
              <span className={styles.mood}>{entry.mood || '📝'}</span>
            </button>
          ))
        )}
      </div>
    </MoeCard>
  )
}
