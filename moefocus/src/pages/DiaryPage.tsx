import { useState, useEffect, useRef } from 'react'
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
  const [pictures, set_pictures] = useState<string[]>([])
  const [has_today, set_has_today] = useState(false)
  const [rotate_enabled, set_rotate_enabled] = useState(true)
  const [rotate_interval, set_rotate_interval] = useState(8)
  const [slot_a_idx, set_slot_a_idx] = useState(0)
  const [slot_b_idx, set_slot_b_idx] = useState(1)
  const [active_slot, set_active_slot] = useState<'a' | 'b'>('a')
  const [sliding, set_sliding] = useState(false)
  const timer_ref = useRef<ReturnType<typeof setInterval> | null>(null)
  const active_slot_ref = useRef(active_slot)
  const slot_a_ref = useRef(slot_a_idx)
  const slot_b_ref = useRef(slot_b_idx)

  active_slot_ref.current = active_slot
  slot_a_ref.current = slot_a_idx
  slot_b_ref.current = slot_b_idx

  useEffect(() =>
  {
    window.electronAPI.diary.list_all().then((rows) =>
    {
      set_entries(rows as unknown as DiaryEntry[])
    })
    load_pictures()
    load_settings()
  }, [])

  useEffect(() =>
  {
    const entry = entries.find((e) => e.date === target_date)
    set_has_today(!!entry)
  }, [target_date, entries])

  const load_pictures = async () =>
  {
    const paths = await window.electronAPI.file.get_diary_pictures()
    if (paths && paths.length > 0)
    {
      set_pictures(paths)
    }
  }

  const load_settings = async () =>
  {
    const enabled = await window.electronAPI.settings.get('diary.rotateEnabled')
    const interval = await window.electronAPI.settings.get('diary.rotateInterval')
    if (enabled !== null) set_rotate_enabled(enabled === 'true')
    if (interval !== null) set_rotate_interval(parseInt(interval, 10) || 8)
  }

  // Auto-rotation with slide animation
  useEffect(() =>
  {
    if (timer_ref.current)
    {
      clearInterval(timer_ref.current)
      timer_ref.current = null
    }

    if (pictures.length <= 1 || !rotate_enabled) return

    timer_ref.current = setInterval(() =>
    {
      const current = active_slot_ref.current === 'a'
        ? slot_a_ref.current
        : slot_b_ref.current
      const next = (current + 1) % pictures.length

      if (active_slot_ref.current === 'a')
      {
        set_slot_b_idx(next)
      }
      else
      {
        set_slot_a_idx(next)
      }

      set_sliding(true)

      setTimeout(() =>
      {
        set_active_slot((prev) => prev === 'a' ? 'b' : 'a')
        set_sliding(false)
      }, 600)
    }, rotate_interval * 1000)

    return () =>
    {
      if (timer_ref.current) clearInterval(timer_ref.current)
    }
  }, [pictures, rotate_enabled, rotate_interval])

  // Group entries by month
  const grouped: Record<string, DiaryEntry[]> = {}
  for (const e of entries)
  {
    const month = e.date.slice(0, 7)
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(e)
  }
  const months = Object.keys(grouped).sort().reverse()

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
      const rows = await window.electronAPI.diary.list_all()
      set_entries(rows as unknown as DiaryEntry[])
    }
  }

  const current_idx = active_slot === 'a' ? slot_a_idx : slot_b_idx
  const show_slot_b = pictures.length > 1

  const slot_a_class = [
    styles.image_slot,
    sliding ? styles.animating : '',
    active_slot === 'a'
      ? (sliding ? styles.exit_left : styles.current)
      : (sliding ? styles.enter_right : styles.standby)
  ].filter(Boolean).join(' ')

  const slot_b_class = [
    styles.image_slot,
    sliding ? styles.animating : '',
    active_slot === 'b'
      ? (sliding ? styles.exit_left : styles.current)
      : (sliding ? styles.enter_right : styles.standby)
  ].filter(Boolean).join(' ')

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

      {/* Main area: rotating photo frame */}
      <div className={styles.main}>
        <MoeCard className={styles.frame_card}>
          {pictures.length > 0 ? (
            <div className={styles.frame_wrapper}>
              <div
                className={styles.image_frame}
                onClick={() =>
                {
                  if (target_date) handle_open(target_date)
                }}
                title="点击用 Typora 打开当天日记"
              >
                <div
                  className={slot_a_class}
                  style={{
                    backgroundImage: `url(local:///${encodeURI((pictures[slot_a_idx] || '').replace(/\\/g, '/'))})`
                  }}
                />
                {show_slot_b && (
                  <div
                    className={slot_b_class}
                    style={{
                      backgroundImage: `url(local:///${encodeURI((pictures[slot_b_idx] || '').replace(/\\/g, '/'))})`
                    }}
                  />
                )}
                <div className={styles.frame_overlay}>
                  <span className={styles.frame_date}>{target_date}</span>
                  <div className={styles.frame_info}>
                    {pictures.length > 1 && (
                      <span className={styles.frame_counter}>
                        {current_idx + 1} / {pictures.length}
                        {rotate_enabled && ` · ${rotate_interval}s`}
                      </span>
                    )}
                    {has_today ? (
                      <span className={styles.frame_hint}>点击打开日记</span>
                    ) : (
                      <span className={styles.frame_hint}>日记尚未生成</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.no_image}>
              <span className={styles.no_image_icon}>🖼️</span>
              <p>将图片放入 diary-pictures 文件夹</p>
              <p className={styles.no_image_hint}>
                在项目目录 moefocus/diary-pictures/ 下放入任意图片文件（jpg/png/gif/webp），将在此处自动轮播展示
              </p>
              <p className={styles.no_image_hint}>
                轮播间隔和开关可在「设置 → 通用 → 日记相框」中调整
              </p>
            </div>
          )}
        </MoeCard>
      </div>
    </div>
  )
}
