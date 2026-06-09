import { DatabaseService } from './DatabaseService'
import { generate_diary } from './diary_service'
import type { DiaryEntry, FocusSession, LongTermGoal, SyncResult } from '../types/models'

interface GithubFile
{
  content: string
  sha: string | null
}

interface GithubConfig
{
  owner: string
  repo: string
  branch: string
  token: string
}

function parse_remote_url(remote_url: string): { owner: string; repo: string } | null
{
  const https_match = remote_url.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/)
  if (https_match)
  {
    return { owner: https_match[1], repo: https_match[2] }
  }

  const ssh_match = remote_url.match(/github\.com:([^/]+)\/([^/.]+)(?:\.git)?/)
  if (ssh_match)
  {
    return { owner: ssh_match[1], repo: ssh_match[2] }
  }

  return null
}

function encode_content(text: string): string
{
  const bytes = encode_utf8(text)
  return encode_base64(bytes)
}

function decode_content(text: string): string
{
  const bytes = decode_base64(text.replace(/\n/g, ''))
  return decode_utf8(bytes)
}

const base64_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function encode_utf8(text: string): number[]
{
  const encoded = encodeURIComponent(text)
  const bytes: number[] = []
  for (let i = 0; i < encoded.length; i++)
  {
    if (encoded[i] === '%')
    {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16))
      i += 2
    }
    else
    {
      bytes.push(encoded.charCodeAt(i))
    }
  }
  return bytes
}

function decode_utf8(bytes: number[]): string
{
  const encoded = bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('')
  return decodeURIComponent(encoded)
}

function encode_base64(bytes: number[]): string
{
  let output = ''
  for (let i = 0; i < bytes.length; i += 3)
  {
    const a = bytes[i]
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const triple = (a << 16) | (b << 8) | c

    output += base64_chars[(triple >> 18) & 63]
    output += base64_chars[(triple >> 12) & 63]
    output += i + 1 < bytes.length ? base64_chars[(triple >> 6) & 63] : '='
    output += i + 2 < bytes.length ? base64_chars[triple & 63] : '='
  }
  return output
}

function decode_base64(text: string): number[]
{
  const clean_text = text.replace(/[^A-Za-z0-9+/=]/g, '')
  const bytes: number[] = []

  for (let i = 0; i < clean_text.length; i += 4)
  {
    const a = base64_chars.indexOf(clean_text[i])
    const b = base64_chars.indexOf(clean_text[i + 1])
    const c = clean_text[i + 2] === '=' ? -1 : base64_chars.indexOf(clean_text[i + 2])
    const d = clean_text[i + 3] === '=' ? -1 : base64_chars.indexOf(clean_text[i + 3])

    if (a < 0 || b < 0) continue

    const triple = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d)
    bytes.push((triple >> 16) & 255)
    if (c >= 0) bytes.push((triple >> 8) & 255)
    if (d >= 0) bytes.push(triple & 255)
  }

  return bytes
}

async function get_config(): Promise<GithubConfig>
{
  const settings = await DatabaseService.get_settings()
  const parsed = parse_remote_url(settings['github.remoteUrl'] || '')

  const owner = settings['github.owner'] || parsed?.owner || ''
  const repo = settings['github.repo'] || parsed?.repo || ''
  const branch = settings['github.branch'] || 'main'
  const token = settings['github.token'] || ''

  if (!owner || !repo || !token)
  {
    throw new Error('请先在设置中填写 GitHub 仓库 owner/repo 和 Token')
  }

  return { owner, repo, branch, token }
}

async function github_request<T>(config: GithubConfig, path: string, init: RequestInit = {}): Promise<T>
{
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {})
    }
  })

  if (!response.ok)
  {
    const text = await response.text()
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 180)}`)
  }

  return response.json() as Promise<T>
}

async function read_file(config: GithubConfig, file_path: string): Promise<GithubFile | null>
{
  try
  {
    const data = await github_request<{ content: string; sha: string }>(
      config,
      `/contents/${encodeURIComponent(file_path).replace(/%2F/g, '/')}?ref=${config.branch}`
    )
    return { content: decode_content(data.content), sha: data.sha }
  }
  catch (error)
  {
    if (String(error).includes('GitHub API 404')) return null
    throw error
  }
}

async function write_file(config: GithubConfig, file_path: string, content: string, message: string): Promise<void>
{
  const existing = await read_file(config, file_path)
  await github_request(config, `/contents/${encodeURIComponent(file_path).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encode_content(content),
      branch: config.branch,
      sha: existing?.sha || undefined
    })
  })
}

function to_session_export(sessions: FocusSession[]): Record<string, Omit<FocusSession, 'id' | 'uuid' | 'todo_id' | 'task_title' | 'custom_title'>>
{
  const data: Record<string, Omit<FocusSession, 'id' | 'uuid' | 'todo_id' | 'task_title' | 'custom_title'>> = {}
  for (const session of sessions)
  {
    if (!session.uuid) continue
    data[session.uuid] = {
      subject: session.subject,
      planned_duration_min: session.planned_duration_min,
      actual_duration_sec: session.actual_duration_sec,
      rest_duration_sec: session.rest_duration_sec,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      date: session.date
    }
  }
  return data
}

function to_goal_export(goals: LongTermGoal[]): Record<string, Omit<LongTermGoal, 'id' | 'uuid'>>
{
  const data: Record<string, Omit<LongTermGoal, 'id' | 'uuid'>> = {}
  for (const goal of goals)
  {
    data[goal.uuid] = {
      title: goal.title,
      deadline: goal.deadline,
      status: goal.status,
      sort_order: goal.sort_order,
      is_deleted: goal.is_deleted,
      created_at: goal.created_at,
      updated_at: goal.updated_at
    }
  }
  return data
}

async function import_sessions(data: Record<string, Record<string, unknown>>): Promise<number>
{
  let imported = 0
  for (const [uuid, session] of Object.entries(data))
  {
    const existing = await DatabaseService.get_one<{ id: number }>(
      'SELECT id FROM focus_sessions WHERE uuid = ?',
      [uuid]
    )
    if (existing) continue

    await DatabaseService.run(
      `INSERT INTO focus_sessions
       (uuid, subject, planned_duration_min, actual_duration_sec, rest_duration_sec, status, started_at, ended_at, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        String(session.subject || ''),
        Number(session.planned_duration_min || 0),
        Number(session.actual_duration_sec || 0),
        Number(session.rest_duration_sec || 0),
        String(session.status || 'completed'),
        String(session.started_at || ''),
        session.ended_at ? String(session.ended_at) : null,
        String(session.date || '')
      ]
    )
    imported++
  }
  return imported
}

async function import_goals(data: Record<string, Record<string, unknown>>): Promise<number>
{
  let imported = 0
  for (const [uuid, goal] of Object.entries(data))
  {
    const incoming_updated_at = String(goal.updated_at || '')
    const existing = await DatabaseService.get_one<{ updated_at: string }>(
      'SELECT updated_at FROM long_term_goals WHERE uuid = ?',
      [uuid]
    )

    if (existing && existing.updated_at >= incoming_updated_at) continue

    if (existing)
    {
      await DatabaseService.run(
        `UPDATE long_term_goals
         SET title = ?, deadline = ?, status = ?, sort_order = ?, is_deleted = ?, created_at = ?, updated_at = ?
         WHERE uuid = ?`,
        [
          String(goal.title || ''),
          goal.deadline ? String(goal.deadline) : null,
          String(goal.status || 'active'),
          Number(goal.sort_order || 0),
          Number(goal.is_deleted || 0),
          String(goal.created_at || incoming_updated_at),
          incoming_updated_at,
          uuid
        ]
      )
    }
    else
    {
      await DatabaseService.run(
        `INSERT INTO long_term_goals
         (uuid, title, deadline, status, sort_order, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid,
          String(goal.title || ''),
          goal.deadline ? String(goal.deadline) : null,
          String(goal.status || 'active'),
          Number(goal.sort_order || 0),
          Number(goal.is_deleted || 0),
          String(goal.created_at || incoming_updated_at),
          incoming_updated_at
        ]
      )
    }
    imported++
  }
  return imported
}

export async function sync_with_github(): Promise<SyncResult>
{
  const result: SyncResult = {
    success: false,
    uploaded_files: [],
    downloaded_files: [],
    imported_sessions: 0,
    imported_goals: 0,
    synced_diaries: 0
  }

  try
  {
    const config = await get_config()
    const sessions = await DatabaseService.get_all<FocusSession>(
      "SELECT * FROM focus_sessions WHERE uuid IS NOT NULL AND status = 'completed'"
    )
    const goals = await DatabaseService.get_all<LongTermGoal>(
      'SELECT * FROM long_term_goals WHERE uuid IS NOT NULL'
    )

    const local_sessions = to_session_export(sessions)
    const local_goals = to_goal_export(goals)
    const remote_sessions_file = await read_file(config, 'data/focus_sessions.json')
    const remote_goals_file = await read_file(config, 'data/long_term_goals.json')
    const remote_sessions = remote_sessions_file ? JSON.parse(remote_sessions_file.content) : {}
    const remote_goals = remote_goals_file ? JSON.parse(remote_goals_file.content) : {}

    const merged_sessions = { ...remote_sessions, ...local_sessions }
    const merged_goals = { ...remote_goals, ...local_goals }

    result.imported_sessions = await import_sessions(merged_sessions)
    result.imported_goals = await import_goals(merged_goals)

    await write_file(
      config,
      'data/focus_sessions.json',
      JSON.stringify(merged_sessions, null, 2),
      'sync: update mobile focus sessions'
    )
    result.uploaded_files.push('data/focus_sessions.json')

    await write_file(
      config,
      'data/long_term_goals.json',
      JSON.stringify(merged_goals, null, 2),
      'sync: update mobile long term goals'
    )
    result.uploaded_files.push('data/long_term_goals.json')

    const dates = await DatabaseService.get_all<{ date: string }>(
      "SELECT DISTINCT date FROM focus_sessions WHERE status = 'completed' ORDER BY date"
    )
    for (const row of dates)
    {
      const diary = await generate_diary(row.date)
      await write_file(
        config,
        `sums/${row.date}.md`,
        diary.summary_text || '',
        `sync: update diary ${row.date}`
      )
      result.uploaded_files.push(`sums/${row.date}.md`)
      result.synced_diaries++
    }

    const diary_rows = await DatabaseService.get_all<DiaryEntry>(
      'SELECT * FROM diary_entries WHERE summary_text IS NOT NULL ORDER BY date DESC LIMIT 60'
    )
    for (const diary of diary_rows)
    {
      if (!diary.summary_text) continue
      const path = `sums/${diary.date}.md`
      if (result.uploaded_files.includes(path)) continue
      await write_file(config, path, diary.summary_text, `sync: update diary ${diary.date}`)
      result.uploaded_files.push(path)
    }

    result.success = true
  }
  catch (error)
  {
    result.error = error instanceof Error ? error.message : String(error)
  }

  return result
}
