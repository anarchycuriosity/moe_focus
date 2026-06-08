import dayjs from 'dayjs'
import { DatabaseService } from './DatabaseService'
import type { DiaryEntry, FocusSession } from '../types/models'

function format_total_time(total_seconds: number): string
{
  const total_minutes = Math.floor(total_seconds / 60)
  const hours = Math.floor(total_minutes / 60)
  const minutes = total_minutes % 60
  return `${hours} 小时 ${minutes} 分钟`
}

function format_subject_time(total_seconds: number): string
{
  const total_minutes = Math.floor(total_seconds / 60)
  const hours = Math.floor(total_minutes / 60)
  const minutes = total_minutes % 60

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

export async function generate_diary(date: string): Promise<DiaryEntry>
{
  const sessions = await DatabaseService.get_all<FocusSession>(
    `SELECT *
     FROM focus_sessions
     WHERE date = ? AND status = 'completed'
     ORDER BY started_at`,
    [date]
  )
  const existing = await DatabaseService.get_one<DiaryEntry>(
    'SELECT * FROM diary_entries WHERE date = ?',
    [date]
  )

  const subject_seconds = new Map<string, number>()
  let total_seconds = 0

  for (const session of sessions)
  {
    const subject = session.subject || '未命名'
    total_seconds += session.actual_duration_sec
    subject_seconds.set(subject, (subject_seconds.get(subject) || 0) + session.actual_duration_sec)
  }

  let markdown = `# 📔 Diary - ${date}\n\n`
  markdown += `生成时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`
  markdown += '## 📊 今日统计\n\n'
  markdown += `- **总专注时间**: ${format_total_time(total_seconds)}\n`
  markdown += `- **专注会话数**: ${sessions.length}\n\n`

  if (subject_seconds.size > 0)
  {
    markdown += '## 🎯 事项时间分布\n\n'
    const items = [...subject_seconds.entries()].sort((a, b) => b[1] - a[1])
    for (const [subject, seconds] of items)
    {
      markdown += `- **${subject}**: ${format_subject_time(seconds)}\n`
    }
    markdown += '\n'
  }
  else
  {
    markdown += '今日没有专注记录。\n\n'
  }

  markdown += '## 💭 自我反思\n\n'
  markdown += existing?.reflection_text?.trim()
    ? `${existing.reflection_text.trim()}\n\n`
    : '*(在此写下你今天的思考和感悟...)*\n\n'
  markdown += '---\n\n'
  markdown += '由 MoeFocus Mobile 生成。\n'

  await DatabaseService.run(
    `INSERT INTO diary_entries (date, file_path, summary_text, reflection_text, mood)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       file_path = ?,
       summary_text = ?,
       updated_at = datetime('now')`,
    [
      date,
      `sums/${date}.md`,
      markdown,
      existing?.reflection_text || null,
      existing?.mood || null,
      `sums/${date}.md`,
      markdown
    ]
  )

  const saved = await DatabaseService.get_one<DiaryEntry>(
    'SELECT * FROM diary_entries WHERE date = ?',
    [date]
  )

  if (!saved)
  {
    throw new Error('日记保存失败')
  }

  return saved
}

export async function save_reflection(date: string, reflection_text: string): Promise<void>
{
  await DatabaseService.run(
    `INSERT INTO diary_entries (date, reflection_text, file_path)
     VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       reflection_text = ?,
       updated_at = datetime('now')`,
    [date, reflection_text, `sums/${date}.md`, reflection_text]
  )
}
