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

type GenerateNoticeType = 'success' | 'error'

interface GenerateNotice
{
  type: GenerateNoticeType
  text: string
}

export function DiaryPage(): JSX.Element
{
  const { date } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const target_date = date || dayjs().format('YYYY-MM-DD')

  const [entries, set_entries] = useState<DiaryEntry[]>([])
  const [pictures, set_pictures] = useState<string[]>([])
  const [has_today, set_has_today] = useState(false)
  const [generate_dialog_open, set_generate_dialog_open] = useState(false)
  const [generate_date, set_generate_date] = useState(dayjs().format('YYYY-MM-DD'))
  const [generating, set_generating] = useState(false)
  const [generate_notice, set_generate_notice] = useState<GenerateNotice | null>(null)
  const [clear_dialog_open, set_clear_dialog_open] = useState(false)
  const [clearing_manual_content, set_clearing_manual_content] = useState(false)
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
    const entry = entries.find((e) => e.date === generate_date)
    set_has_today(!!entry)
  }, [generate_date, entries])

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
  const has_target_entry = entries.some((e) => e.date === target_date)

  const handle_open = async (d: string) =>
  {
    const entry = await window.electronAPI.diary.get_by_date(d)
    if (entry?.file_path)
    {
      await window.electronAPI.file.open_in_typora(entry.file_path as string)
    }
  }

  const handle_generate_click = () =>
  {
    set_generate_date(dayjs().format('YYYY-MM-DD'))
    set_generate_dialog_open(true)
  }

  const handle_generate_confirm = async () =>
  {
    if (generating) return

    set_generating(true)
    set_generate_notice(null)
    try
    {
      const date_to_generate = generate_date || dayjs().format('YYYY-MM-DD')
      const result = await window.electronAPI.diary.generate(date_to_generate)
      if (!result.success)
      {
        set_generate_notice({ type: 'error', text: '日记生成失败，请稍后重试。' })
        return
      }

      const rows = await window.electronAPI.diary.list_all()
      set_entries(rows as unknown as DiaryEntry[])
      set_has_today(true)
      set_generate_dialog_open(false)
      set_generate_notice({ type: 'success', text: `${date_to_generate} 的日记统计已更新，已打开 Typora。` })

      if (result.file_path)
      {
        await window.electronAPI.file.open_in_typora(result.file_path)
      }
    }
    catch (error)
    {
      const error_text = error instanceof Error ? error.message : '未知错误'
      set_generate_notice({ type: 'error', text: `日记生成失败: ${error_text}` })
    }
    finally
    {
      set_generating(false)
    }
  }

  const handle_clear_manual_content = async () =>
  {
    if (clearing_manual_content) return

    set_clearing_manual_content(true)
    set_generate_notice(null)
    try
    {
      const result = await window.electronAPI.diary.clear_manual_content(target_date)
      if (!result.success)
      {
        set_generate_notice({ type: 'error', text: result.error || '自定义总结清空失败。' })
        return
      }

      set_clear_dialog_open(false)
      set_generate_notice({ type: 'success', text: `${target_date} 的自定义总结已清空，后续同步不会再拉回旧反思。` })
      if (result.file_path)
      {
        try
        {
          const open_result = await window.electronAPI.file.open_in_typora(result.file_path)
          if (!open_result.success)
          {
            set_generate_notice({ type: 'success', text: `${target_date} 的自定义总结已清空，但 Typora 未能自动打开。` })
          }
        }
        catch
        {
          set_generate_notice({ type: 'success', text: `${target_date} 的自定义总结已清空，但 Typora 未能自动打开。` })
        }
      }
    }
    catch (error)
    {
      const error_text = error instanceof Error ? error.message : '未知错误'
      set_generate_notice({ type: 'error', text: `自定义总结清空失败: ${error_text}` })
    }
    finally
    {
      set_clearing_manual_content(false)
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
          <MoeButton variant="primary" size="sm" onClick={handle_generate_click} disabled={generating}>
            生成今日
          </MoeButton>
        </div>
        {generate_notice && (
          <div className={`${styles.generate_notice} ${styles[generate_notice.type]}`} role="status">
            {generate_notice.text}
          </div>
        )}
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
          <div className={styles.frame_actions}>
            <MoeButton
              variant="ghost"
              size="sm"
              onClick={() => set_clear_dialog_open(true)}
              disabled={!has_target_entry || clearing_manual_content}
            >
              清空自定义总结
            </MoeButton>
          </div>
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

      {generate_dialog_open && (
        <div className={styles.modal_backdrop} role="presentation">
          <div className={styles.generate_dialog} role="dialog" aria-modal="true" aria-labelledby="generate_dialog_title">
            <h3 id="generate_dialog_title">
              {has_today ? '更新当天统计？' : '生成当天日记'}
            </h3>
            <p>
              {has_today
                ? `${generate_date} 已经存在日记。继续生成只会刷新程序统计区，你手写的反思和额外内容会保留。`
                : `将根据 ${generate_date} 的专注记录生成一篇日记。生成完成后会打开 Typora，方便你审核和修改。`}
            </p>
            {has_today && (
              <p className={styles.danger_text}>
                MoeFocus 会自动维护统计区；标记区外的手写内容不会被生成操作覆盖。
              </p>
            )}
            <div className={styles.dialog_actions}>
              <MoeButton
                variant="ghost"
                size="sm"
                onClick={() => set_generate_dialog_open(false)}
                disabled={generating}
              >
                取消
              </MoeButton>
              <MoeButton
                variant={has_today ? 'secondary' : 'primary'}
                size="sm"
                onClick={handle_generate_confirm}
                disabled={generating}
              >
                {generating ? '生成中...' : has_today ? '更新统计' : '确认生成'}
              </MoeButton>
            </div>
          </div>
        </div>
      )}

      {clear_dialog_open && (
        <div className={styles.modal_backdrop} role="presentation">
          <div className={styles.generate_dialog} role="dialog" aria-modal="true" aria-labelledby="clear_dialog_title">
            <h3 id="clear_dialog_title">清空自定义总结？</h3>
            <p>
              将清空 {target_date} 的自我反思和手写总结，并写入同步删除标记。统计区和当天专注数据不会被删除。
            </p>
            <p className={styles.danger_text}>
              后续同步时，其他电脑上的旧反思不会再自动合并回来；如需恢复，请从 .bak 备份或 Git 历史中手动找回。
            </p>
            <div className={styles.dialog_actions}>
              <MoeButton
                variant="ghost"
                size="sm"
                onClick={() => set_clear_dialog_open(false)}
                disabled={clearing_manual_content}
              >
                取消
              </MoeButton>
              <MoeButton
                variant="secondary"
                size="sm"
                onClick={handle_clear_manual_content}
                disabled={clearing_manual_content}
              >
                {clearing_manual_content ? '清空中...' : '确认清空'}
              </MoeButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
