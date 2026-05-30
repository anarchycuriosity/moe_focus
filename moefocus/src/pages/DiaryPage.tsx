import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { MoeCard } from '../components/common/MoeCard'
import { MoeButton } from '../components/common/MoeButton'
import styles from './DiaryPage.module.css'

interface DiaryEntry
{
  date: string
  file_path: string | null
  mood: string | null
}

export function DiaryPage(): JSX.Element
{
  const { date } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const target_date = date || dayjs().format('YYYY-MM-DD')

  const [entries, set_entries] = useState<DiaryEntry[]>([])
  const [wallpapers, set_wallpapers] = useState<string[]>([])
  const [img_idx, set_img_idx] = useState(0)
  const [has_today, set_has_today] = useState(false)

  useEffect(() =>
  {
    window.electronAPI.diary.list_all().then((rows) =>
    {
      set_entries(rows as unknown as DiaryEntry[])
    })
    load_wallpapers()
  }, [])

  useEffect(() =>
  {
    const entry = entries.find((e) => e.date === target_date)
    set_has_today(!!entry)
  }, [target_date, entries])

  const load_wallpapers = async () =>
  {
    const path = await window.electronAPI.settings.get('ui.active_wallpaper')
    if (path)
    {
      set_wallpapers([path])
    }
  }

  // Group entries by month
  const grouped: Record<string, DiaryEntry[]> = {}
  for (const e of entries)
  {
    const month = e.date.slice(0, 7) // 'YYYY-MM'
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(e)
  }
  const months = Object.keys(grouped).sort().reverse()

  // Cycle wallpaper image every 5 seconds
  useEffect(() =>
  {
    if (wallpapers.length <= 1) return
    const timer = setInterval(() =>
    {
      set_img_idx((prev) => (prev + 1) % wallpapers.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [wallpapers])

  const handle_open = async (d: string) =>
  {
    const entry = await window.electronAPI.diary.get_by_date(d)
    if (entry?.file_path)
    {
      await window.electronAPI.file.open_in_typora(entry.file_path as string)
    }
  }

  const handle_delete = async (d: string) =>
  {
    await window.electronAPI.diary.delete_entry(d)
    set_entries((prev) => prev.filter((e) => e.date !== d))
  }

  const handle_generate = async () =>
  {
    const result = await window.electronAPI.diary.generate(target_date)
    if (result.success)
    {
      // Refresh list
      const rows = await window.electronAPI.diary.list_all()
      set_entries(rows as unknown as DiaryEntry[])
    }
  }

  const current_wallpaper = wallpapers[img_idx % wallpapers.length] || ''

  return (
    <div className={styles.page}>
      {/* Left sidebar: monthly archive */}
      <div className={styles.sidebar}>
        <div className={styles.sidebar_header}>
          <h3>📅 日记归档</h3>
          <MoeButton variant="primary" size="sm" onClick={handle_generate}>
            生成今日
          </MoeButton>
        </div>
        <div className={styles.month_list}>
          {months.length === 0 ? (
            <p className={styles.empty}>暂无日记</p>
          ) : (
            months.map((month) => (
              <div key={month} className={styles.month_group}>
                <div className={styles.month_label}>{month}</div>
                {grouped[month].map((e) => (
                  <div
                    key={e.date}
                    className={`${styles.date_row} ${e.date === target_date ? styles.active : ''}`}
                  >
                    <button
                      className={styles.date_btn}
                      onClick={() => navigate(`/diary/${e.date}`)}
                    >
                      <span>{e.date.slice(8)}</span>
                      <span className={styles.day_of_week}>
                        {dayjs(e.date).format('ddd')}
                      </span>
                    </button>
                    <button
                      className={styles.open_btn}
                      onClick={() => handle_open(e.date)}
                      title="用 Typora 打开"
                    >
                      📝
                    </button>
                    <button
                      className={styles.delete_btn}
                      onClick={() => handle_delete(e.date)}
                      title="删除日记"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main area: image frame + selected date info */}
      <div className={styles.main}>
        <MoeCard className={styles.frame_card}>
          {current_wallpaper ? (
            <div
              className={styles.image_frame}
              style={{ backgroundImage: `url(file:///${current_wallpaper.replace(/\\/g, '/')})` }}
              onClick={() =>
              {
                if (target_date) handle_open(target_date)
              }}
              title="点击用 Typora 打开当天日记"
            >
              <div className={styles.frame_overlay}>
                <span className={styles.frame_date}>{target_date}</span>
                {has_today ? (
                  <span className={styles.frame_hint}>点击打开日记</span>
                ) : (
                  <span className={styles.frame_hint}>日记尚未生成</span>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.no_image}>
              <span className={styles.no_image_icon}>🖼️</span>
              <p>在设置中选择壁纸图片</p>
              <p className={styles.no_image_hint}>壁纸将在此处展示</p>
            </div>
          )}
        </MoeCard>
      </div>
    </div>
  )
}
