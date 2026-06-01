// ===== Phase 5: Git 同步服务 =====
// 基于 simple-git 封装 commit/push/pull/remote 操作
// Phase 5 实现日记自动提交; Phase 8 扩展双 PC 数据同步

import { simpleGit, type SimpleGit } from 'simple-git'
import { app } from 'electron'
import { join, basename } from 'path'
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { merge_diaries, type SyncResult } from './SyncService'

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
      '*.db-shm',
      'Cache/',
      'Code Cache/',
      'DawnCache/',
      'GPUCache/',
      'Local Storage/',
      'Network/',
      'Session Storage/',
      'Shared Dictionary/',
      'SharedStorage/',
      'Local State',
      'Preferences'
    ]

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

  private async get_current_branch(): Promise<string>
  {
    try
    {
      const g = await this.get_git()
      const status = await g.status()
      return status.current || 'main'
    }
    catch
    {
      return 'main'
    }
  }

  async check_sync_status(branch?: string): Promise<{
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
      result.branch = branch || status.current || 'main'
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
        const tracking_branch = result.branch
        const behind_raw = await g.raw(['rev-list', '--count', `${tracking_branch}..origin/${tracking_branch}`])
        const ahead_raw = await g.raw(['rev-list', '--count', `origin/${tracking_branch}..${tracking_branch}`])
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

  async push(branch?: string): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const g = await this.get_git()
      const target = branch || (await this.get_current_branch())
      await g.push('origin', target)
      return { success: true }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
    }
  }

  async pull(branch?: string): Promise<{ success: boolean; error?: string }>
  {
    try
    {
      const g = await this.get_git()
      const target = branch || (await this.get_current_branch())
      await g.pull('origin', target)
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

  async sync(branch?: string): Promise<SyncResult>
  {
    const result: SyncResult = {
      success: false,
      merged_files: [],
      new_from_remote: [],
      new_subjects: [],
      total_added_minutes: 0
    }

    try
    {
      const g = await this.get_git()
      const target = branch || (await this.get_current_branch())

      await this.init_repo()
      const remote = await this.get_remote()
      if (!remote.url)
      {
        result.error = '未配置远程仓库地址'
        return result
      }

      await g.fetch('origin')

      const sums_dir = join(this.repo_path, 'sums')
      if (!existsSync(sums_dir)) mkdirSync(sums_dir, { recursive: true })

      // Save all local diary content before aligning with remote
      const local_snapshot = new Map<string, string>()
      try
      {
        const local_files = readdirSync(sums_dir).filter((f) => f.endsWith('.md'))
        for (const f of local_files)
        {
          local_snapshot.set(f, readFileSync(join(sums_dir, f), 'utf-8'))
        }
      }
      catch { /* sums/ may not exist */ }

      // Align local branch with remote (handles unrelated histories + branch mismatch)
      let remote_has_branch = false
      try
      {
        await g.raw(['checkout', '-B', target, `origin/${target}`])
        remote_has_branch = true
      }
      catch
      {
        // Remote branch doesn't exist yet (first push) — just ensure local branch exists
        try { await g.raw(['checkout', '-B', target]) } catch { /* ok */ }
      }

      // Now working tree reflects remote state. Read current files (remote versions)
      const current_files = new Map<string, string>()
      try
      {
        for (const f of readdirSync(sums_dir).filter((f) => f.endsWith('.md')))
        {
          current_files.set(f, readFileSync(join(sums_dir, f), 'utf-8'))
        }
      }
      catch { /* sums/ may not exist */ }

      // Merge local snapshot with current (remote) versions
      for (const [filename, local_content] of local_snapshot)
      {
        const remote_content = current_files.get(filename)

        if (remote_content)
        {
          const merged = merge_diaries(local_content, remote_content)
          if (merged && merged !== remote_content)
          {
            writeFileSync(join(sums_dir, filename), merged, 'utf-8')
            result.merged_files.push(filename)
          }
        }
        else
        {
          // Local-only file — write it
          writeFileSync(join(sums_dir, filename), local_content, 'utf-8')
          result.new_from_remote.push(filename) // reuse field: files pushed from local
        }
      }

      // Remote-only files are already on disk (from checkout), no action needed

      // Stage and commit
      this.ensure_gitignore()
      await g.add(['sums/', '.gitignore'])

      const status = await g.status()
      if (status.files.length > 0)
      {
        await g.commit('sync: merge diary data')
      }

      // Push (only if remote branch exists or we have commits to push)
      if (remote_has_branch || status.files.length > 0)
      {
        await g.push('origin', target)
      }

      result.success = true
    }
    catch (e)
    {
      result.error = String(e)
    }

    return result
  }
}

export const git_service = new GitService()
