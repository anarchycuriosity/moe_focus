import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MoeCard } from '../components/common/MoeCard'
import { MoeButton } from '../components/common/MoeButton'
import { DiaryTimeline } from '../components/diary/DiaryTimeline'
import styles from './DiaryPage.module.css'

export function DiaryPage(): JSX.Element
{
  const { date } = useParams<{ date?: string }>()
  const target_date = date || dayjs().format('YYYY-MM-DD')

  const [content, set_content] = useState<string>('')
  const [reflection, set_reflection] = useState<string>('')
  const [loading, set_loading] = useState(false)
  const [show_timeline, set_show_timeline] = useState(false)
  const [has_entry, set_has_entry] = useState(false)

  const load_diary = async () =>
  {
    set_loading(true)
    const entry = await window.electronAPI.diary.get_by_date(target_date)
    if (entry)
    {
      set_has_entry(true)
      set_content((entry.summary_text as string) || '')
      set_reflection((entry.reflection_text as string) || '')
    }
    else
    {
      set_has_entry(false)
      set_content('')
      set_reflection('')
    }
    set_loading(false)
  }

  useEffect(() =>
  {
    load_diary()
  }, [target_date])

  const handle_generate = async () =>
  {
    const result = await window.electronAPI.diary.generate(target_date)
    if (result.success)
    {
      set_content(result.content as string)
      set_has_entry(true)
    }
  }

  const handle_save_reflection = async () =>
  {
    await window.electronAPI.diary.save_reflection(target_date, reflection)
  }

  const handle_open_typora = async () =>
  {
    const entry = await window.electronAPI.diary.get_by_date(target_date)
    if (entry?.file_path)
    {
      await window.electronAPI.file.open_in_typora(entry.file_path as string)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {date ? `${target_date} 日记` : '今日日记'}
        </h2>
        <div className={styles.actions}>
          <MoeButton variant="ghost" size="sm" onClick={() => set_show_timeline(!show_timeline)}>
            📅 历史
          </MoeButton>
          {has_entry && (
            <MoeButton variant="ghost" size="sm" onClick={handle_open_typora}>
              📝 Typora
            </MoeButton>
          )}
          <MoeButton variant="primary" size="sm" onClick={handle_generate}>
            {has_entry ? '重新生成' : '生成日记'}
          </MoeButton>
        </div>
      </div>

      <div className={styles.layout}>
        {show_timeline && (
          <div className={styles.timeline_sidebar}>
            <DiaryTimeline
              on_select={() => set_show_timeline(false)}
            />
          </div>
        )}

        <div className={styles.main}>
          {loading ? (
            <MoeCard className={styles.diary_card}>
              <p className={styles.loading}>加载中...</p>
            </MoeCard>
          ) : !has_entry ? (
            <MoeCard className={styles.diary_card}>
              <div className={styles.empty}>
                <span className={styles.empty_icon}>📔</span>
                <p>今日日记尚未生成</p>
                <p className={styles.hint}>
                  点击「生成日记」自动汇总今天的专注记录和任务完成情况
                </p>
              </div>
            </MoeCard>
          ) : (
            <>
              <MoeCard className={styles.diary_card}>
                <div className={styles.markdown_body}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              </MoeCard>

              <MoeCard className={styles.reflection_card}>
                <h3 className={styles.reflection_title}>💭 自我反思</h3>
                <textarea
                  className={styles.reflection_input}
                  value={reflection}
                  onChange={(e) => set_reflection(e.target.value)}
                  placeholder="写下你今天的思考和感悟..."
                  rows={8}
                />
                <div className={styles.reflection_actions}>
                  <MoeButton variant="primary" size="sm" onClick={handle_save_reflection}>
                    保存反思
                  </MoeButton>
                </div>
              </MoeCard>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
