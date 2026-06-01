// ===== Sync Service: 日记 Markdown 语义合并 =====
// 解析 sums/YYYY-MM-DD.md 中的时间数据，合并本地与远程版本
// 总专注时间 + 事项时间分布按科目累加，自我反思保留本地

interface DiaryTimeData
{
  total_minutes: number
  session_count: number
  subject_times: Map<string, number>   // subject_name → minutes
  prefix: string                        // everything before 今日统计
  reflection: string                    // 自我反思内容
  suffix: string                        // 反思之后的尾部
}

function parse_time_str(text: string): number
{
  // Parse time strings like "2h 30m", "1h 0m", "45m", "2h"
  let minutes = 0
  const h_match = text.match(/(\d+)\s*h/)
  const m_match = text.match(/(\d+)\s*m/)
  if (h_match) minutes += parseInt(h_match[1], 10) * 60
  if (m_match) minutes += parseInt(m_match[1], 10)
  return minutes
}

function parse_total_time(text: string): number
{
  // Parse "X 小时 Y 分钟" or just numbers
  let minutes = 0
  const h_match = text.match(/(\d+)\s*小时/)
  const m_match = text.match(/(\d+)\s*分钟/)
  if (h_match) minutes += parseInt(h_match[1], 10) * 60
  if (m_match) minutes += parseInt(m_match[1], 10)
  // Fallback: try "Xh Ym" format
  if (minutes === 0) minutes = parse_time_str(text)
  return minutes
}

function format_total_time(total_minutes: number): string
{
  const h = Math.floor(total_minutes / 60)
  const m = total_minutes % 60
  return `${h} 小时 ${m} 分钟`
}

function format_subject_time(minutes: number): string
{
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function parse_diary(markdown: string): DiaryTimeData | null
{
  const result: DiaryTimeData = {
    total_minutes: 0,
    session_count: 0,
    subject_times: new Map(),
    prefix: '',
    reflection: '',
    suffix: ''
  }

  // Find the stats section
  const stats_start = markdown.indexOf('## 📊 今日统计')
  if (stats_start === -1) return null

  result.prefix = markdown.slice(0, stats_start).trimEnd()

  // Find subject breakdown section
  const subject_start = markdown.indexOf('## 🎯 事项时间分布')
  const reflection_start = markdown.indexOf('## 💭 自我反思')

  if (reflection_start === -1) return null

  // Parse stats section (between 今日统计 and 事项时间分布 or 自我反思)
  const stats_end = subject_start !== -1 ? subject_start : reflection_start
  const stats_section = markdown.slice(stats_start, stats_end)

  // Extract total time
  const total_match = stats_section.match(/\*\*总专注时间\*\*:\s*(.+)/)
  if (total_match)
  {
    result.total_minutes = parse_total_time(total_match[1].trim())
  }

  // Extract session count
  const session_match = stats_section.match(/\*\*专注会话数\*\*:\s*(\d+)/)
  if (session_match)
  {
    result.session_count = parseInt(session_match[1], 10)
  }

  // Parse subject times
  if (subject_start !== -1)
  {
    const subject_section = markdown.slice(subject_start, reflection_start)
    const lines = subject_section.split('\n')
    for (const line of lines)
    {
      // Match "- **Subject Name**: Xh Ym"
      const match = line.match(/-\s*\*\*(.+?)\*\*:\s*(.+)/)
      if (match)
      {
        const name = match[1].trim()
        const time = parse_time_str(match[2].trim())
        if (time > 0)
        {
          result.subject_times.set(name, time)
        }
      }
    }
  }

  // Extract reflection
  const after_reflection = markdown.slice(reflection_start)
  const reflection_lines = after_reflection.split('\n')

  // Find the end of reflection section (--- marker)
  const separator_idx = reflection_lines.findIndex((l) => l.startsWith('---'))
  if (separator_idx !== -1)
  {
    result.reflection = reflection_lines.slice(1, separator_idx).join('\n').trim()
    result.suffix = reflection_lines.slice(separator_idx).join('\n')
  }
  else
  {
    result.reflection = reflection_lines.slice(1).join('\n').trim()
    result.suffix = ''
  }

  return result
}

function format_diary(data: DiaryTimeData, date: string): string
{
  let md = ''
  if (data.prefix) md += data.prefix + '\n\n'

  md += '## 📊 今日统计\n\n'
  md += `- **总专注时间**: ${format_total_time(data.total_minutes)}\n`
  md += `- **专注会话数**: ${data.session_count}\n\n`

  if (data.subject_times.size > 0)
  {
    md += '## 🎯 事项时间分布\n\n'
    const sorted = [...data.subject_times.entries()].sort((a, b) => b[1] - a[1])
    for (const [subject, minutes] of sorted)
    {
      md += `- **${subject}**: ${format_subject_time(minutes)}\n`
    }
    md += '\n'
  }
  else
  {
    md += '今日没有专注记录。\n\n'
  }

  md += '## 💭 自我反思\n\n'
  if (data.reflection)
  {
    md += data.reflection + '\n\n'
  }
  else
  {
    md += '*(在此写下你今天的思考和感悟...)*\n\n'
  }

  if (data.suffix) md += data.suffix + '\n'

  return md
}

export function merge_diaries(local_md: string, remote_md: string): string | null
{
  const local = parse_diary(local_md)
  const remote = parse_diary(remote_md)

  if (!local && !remote) return null
  if (!local) return remote_md
  if (!remote) return local_md

  // Merge
  const merged: DiaryTimeData = {
    total_minutes: local.total_minutes + remote.total_minutes,
    session_count: local.session_count + remote.session_count,
    subject_times: new Map(),
    prefix: local.prefix,
    reflection: local.reflection,
    suffix: local.suffix
  }

  // Merge subject times
  for (const [name, mins] of local.subject_times)
  {
    merged.subject_times.set(name, (merged.subject_times.get(name) || 0) + mins)
  }
  for (const [name, mins] of remote.subject_times)
  {
    merged.subject_times.set(name, (merged.subject_times.get(name) || 0) + mins)
  }

  // Extract date from prefix (e.g., "# 📔 Diary - 2026-06-01")
  const date_match = local.prefix.match(/Diary\s*-\s*(\d{4}-\d{2}-\d{2})/)
  const date = date_match ? date_match[1] : ''

  return format_diary(merged, date)
}

export interface SyncResult
{
  success: boolean
  merged_files: string[]
  new_from_remote: string[]
  new_subjects: string[]
  total_added_minutes: number
  error?: string
}
