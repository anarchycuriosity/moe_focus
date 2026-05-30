// ===== Phase 5: Git 同步服务 =====
// 基于 simple-git 封装 commit/push/pull/remote 操作
// Phase 5 实现日记自动提交; Phase 8 扩展双 PC 数据同步

import { simpleGit, type SimpleGit } from 'simple-git'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, existsSync, mkdirSync } from 'fs'

export class GitService
{
  private git: SimpleGit | null = null
  private repo_path: string = ''

  constructor()
  {
    this.repo_path = app.getPath('userData')
  }

  private async get_git(): Promise<SimpleGit>
  {
    if (!this.git)
    {
      this.git = simpleGit(this.repo_path)
    }
    return this.git
  }

  // Ensure .gitignore exists in userData to prevent syncing sensitive files
  ensure_gitignore(): void
  {
    const gitignore_path = join(this.repo_path, '.gitignore')
    const entries = [
      '*.db',
      '*.db-wal',
      '*.db-shm'
    ]

    if (existsSync(gitignore_path))
    {
      return
    }

    writeFileSync(gitignore_path, entries.join('\n') + '\n', 'utf-8')
  }

  async get_status(): Promise<Record<string, unknown>>
  {
    try
    {
      const g = await this.get_git()
      const status = await g.status()
      return { status: status.current || 'ok', files: status.files }
    }
    catch (e)
    {
      return { status: 'error', error: String(e) }
    }
  }

  async check_sync_status(): Promise<{
    is_repo: boolean
    has_remote: boolean
    remote_url: string
    branch: string
    uncommitted: number
    ahead: number
    behind: number
    last_commit: string
    error: string
  }>
  {
    const result = {
      is_repo: false,
      has_remote: false,
      remote_url: '',
      branch: '',
      uncommitted: 0,
      ahead: 0,
      behind: 0,
      last_commit: '',
      error: ''
    }

    try
    {
      const g = await this.get_git()
      result.is_repo = await g.checkIsRepo()

      if (!result.is_repo)
      {
        result.error = 'Git 仓库未初始化'
        return result
      }

      const remotes = await g.getRemotes(true)
      const origin = remotes.find((r) => r.name === 'origin')
      result.has_remote = !!origin
      result.remote_url = origin?.refs?.fetch || ''

      const status = await g.status()
      result.branch = status.current || ''
      result.uncommitted = status.files.length

      if (result.has_remote)
      {
        try
        {
          await g.fetch('origin')
        }
        catch
        {
          // fetch may fail if no network, ignore
        }
      }

      const log = await g.log({ maxCount: 1 })
      if (log.latest)
      {
        result.last_commit = `${log.latest.date} — ${log.latest.message.slice(0, 60)}`
      }

      // Count ahead/behind via rev-list style
      try
      {
        const branch = status.current || 'main'
        const behind_raw = await g.raw(['rev-list', '--count', `${branch}..origin/${branch}`])
        const ahead_raw = await g.raw(['rev-list', '--count', `origin/${branch}..${branch}`])
        result.behind = parseInt(behind_raw.trim(), 10) || 0
        result.ahead = parseInt(ahead_raw.trim(), 10) || 0
      }
      catch
      {
        // branch may not exist on remote yet
      }
    }
    catch (e)
    {
      result.error = String(e)
    }

    return result
  }

  async commit(message: string): Promise<{ success: boolean; message?: string }>
  {
    try
    {
      const g = await this.get_git()

      this.ensure_gitignore()

      const sums_path = join(this.repo_path, 'sums')
      const data_path = join(this.repo_path, 'data')
      if (!existsSync(sums_path)) mkdirSync(sums_path, { recursive: true })
      if (!existsSync(data_path)) mkdirSync(data_path, { recursive: true })

      // Only sync sums/ (diary markdown) and data/ (JSON exports), not the database
      await g.add(['sums/', 'data/'])
      const result = await g.commit(message)
      return { success: true, message: result.commit || 'committed' }
    }
    catch (e)
    {
      return { success: false, message: String(e) }
    }
  }

  async push(): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const g = await this.get_git()
      await g.push('origin', 'main')
      return { success: true }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
    }
  }

  async pull(): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const g = await this.get_git()
      await g.pull('origin', 'main')
      return { success: true }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
    }
  }

  async set_remote(url: string): Promise<{ success: boolean; url: string }>
  {
    try
    {
      const g = await this.get_git()

      // Check if remote origin exists
      const remotes = await g.getRemotes(true)
      const has_origin = remotes.some((r) => r.name === 'origin')

      if (has_origin)
      {
        await g.remote(['set-url', 'origin', url])
      }
      else
      {
        await g.addRemote('origin', url)
      }

      return { success: true, url }
    }
    catch (e)
    {
      return { success: false, url }
    }
  }

  async get_remote(): Promise<{ url: string }>
  {
    try
    {
      const g = await this.get_git()
      const remotes = await g.getRemotes(true)
      const origin = remotes.find((r) => r.name === 'origin')
      return { url: origin?.refs?.fetch || '' }
    }
    catch
    {
      return { url: '' }
    }
  }

  async init_repo(): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const g = await this.get_git()

      const is_repo = await g.checkIsRepo()
      if (!is_repo)
      {
        await g.init()
      }

      this.ensure_gitignore()

      return { success: true }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
    }
  }
}

export const git_service = new GitService()
