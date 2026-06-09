// ===== Phase 5: Git 同步服务 =====
// 基于 simple-git 封装 commit/push/pull/remote 操作
// Phase 5 实现日记自动提交; Phase 8 扩展双 PC 数据同步

import { simpleGit, type SimpleGit } from 'simple-git'
import { app } from 'electron'
import { join, basename } from 'path'
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { merge_diary_manual_content, type SyncResult } from './SyncService'

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
      '*.bak',
      '*.recovered-*',
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
      result.is_repo = existsSync(join(this.repo_path, '.git'))

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
      const trimmed_url = url.trim()

      // Check if remote origin exists
      const remotes = await g.getRemotes(true)
      const has_origin = remotes.some((r) => r.name === 'origin')

      if (!trimmed_url)
      {
        if (has_origin)
        {
          await g.removeRemote('origin')
        }
        return { success: true, url: '' }
      }

      if (has_origin)
      {
        await g.remote(['set-url', 'origin', trimmed_url])
      }
      else
      {
        await g.addRemote('origin', trimmed_url)
      }

      return { success: true, url: trimmed_url }
    }
    catch (e)
    {
      return { success: false, url }
    }
  }

  async validate_remote(url: string, branch?: string): Promise<{ success: boolean; error?: string; branch_exists?: boolean }>
  {
    const trimmed_url = url.trim()
    if (!trimmed_url)
    {
      return { success: false, error: '远程仓库地址为空' }
    }

    try
    {
      const g = await this.get_git()
      const target = branch || 'main'
      const refs = await g.raw(['ls-remote', '--heads', trimmed_url, target])
      return { success: true, branch_exists: refs.trim().length > 0 }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
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

      // Check .git exists at exact path — NOT checkIsRepo() which walks up
      // and may find a .git in a parent directory (e.g. C:\Users\<user>)
      const git_dir = join(this.repo_path, '.git')
      if (!existsSync(git_dir))
      {
        // --initial-branch=main avoids master/main mismatch on first push
        await g.raw(['init', '--initial-branch=main'])
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

      // Align local branch name with target (legacy repos may use 'master')
      try
      {
        const head = await g.raw(['rev-parse', '--abbrev-ref', 'HEAD'])
        const current = head.trim()
        if (current !== 'HEAD' && current !== target)
        {
          await g.raw(['branch', '-m', current, target])
        }
      }
      catch
      {
        // No commits yet or rename failed — non-fatal
      }

      const remote = await this.get_remote()
      if (!remote.url)
      {
        result.error = '未配置远程仓库地址'
        return result
      }

      // fetch: 拉取远程所有对象和引用。必须在任何 remote_has_branch
      // 检查之前完成，之后用纯本地 rev-parse 验证（不再走网络）。
      try
      {
        await g.fetch('origin')
      }
      catch (e)
      {
        result.error = `无法连接远程仓库 (fetch失败): ${String(e)}`
        return result
      }

      const sums_dir = join(this.repo_path, 'sums')
      const data_dir = join(this.repo_path, 'data')
      if (!existsSync(sums_dir)) mkdirSync(sums_dir, { recursive: true })
      if (!existsSync(data_dir)) mkdirSync(data_dir, { recursive: true })

      // 使用本地 rev-parse 验证远程追踪分支是否存在
      // （fetch 已拉取所有对象，rev-parse 无网络开销，不会因认证问题静默失败）
      let remote_has_branch = false
      try
      {
        const resolved = await g.raw(['rev-parse', '--verify', `origin/${target}`])
        remote_has_branch = resolved.trim().length > 0
      }
      catch
      {
        // 远程仓库存在但可能为空（无任何提交），此时 remote_has_branch = false
      }

      // Snapshot local files before any modification
      const snapshot_dir = (dir: string, exts: string[]): Map<string, string> =>
      {
        const snap = new Map<string, string>()
        try
        {
          if (existsSync(dir))
          {
            for (const f of readdirSync(dir))
            {
              if (exts.some((ext) => f.endsWith(ext)))
              {
                snap.set(f, readFileSync(join(dir, f), 'utf-8'))
              }
            }
          }
        }
        catch { /* dir may not exist */ }
        return snap
      }

      const sums_snapshot = snapshot_dir(sums_dir, ['.md'])
      const data_snapshot = snapshot_dir(data_dir, ['.json'])

      // 对齐本地 git 历史到远程，防止非 fast-forward push 冲突。
      // 本地数据已经快照到内存，reset 只影响工作区 git 历史，不丢数据。
      if (remote_has_branch)
      {
        try
        {
          await g.raw(['reset', '--hard', `origin/${target}`])
        }
        catch (e)
        {
          // reset 失败时继续用 git show 方式拉取远程内容（降级路径）
          console.error('[sync] reset --hard failed, falling back to git show:', e)
        }
      }

      // 读取远程文件（reset 后工作区即是远程内容，直接读磁盘）
      const read_remote_dir = (dir: string, exts: string[]): Map<string, string> =>
      {
        const files = new Map<string, string>()
        if (!remote_has_branch) return files
        try
        {
          if (existsSync(dir))
          {
            for (const f of readdirSync(dir))
            {
              if (exts.some((ext) => f.endsWith(ext)))
              {
                files.set(f, readFileSync(join(dir, f), 'utf-8'))
              }
            }
          }
        }
        catch { /* dir may not exist */ }
        return files
      }

      const remote_sums = read_remote_dir(sums_dir, ['.md'])
      const remote_data = read_remote_dir(data_dir, ['.json'])

      result.remote_sums_count = remote_sums.size
      result.remote_data_count = remote_data.size

      // 诊断: 远程分支存在但没有拉取到任何文件 → 数据仓库可能为空
      if (remote_has_branch && remote_sums.size === 0 && remote_data.size === 0)
      {
        console.log('[sync] 远程分支存在但 sums/ 和 data/ 目录为空 — 数据仓库可能尚未初始化')
      }

      // MD diary files: stats are regenerated from UUID-deduped JSON later.
      // Here we only protect user-written manual content such as 自我反思.
      const all_sum_files = new Set([...sums_snapshot.keys(), ...remote_sums.keys()])
      for (const filename of all_sum_files)
      {
        const local_content = sums_snapshot.get(filename)
        const remote_content = remote_sums.get(filename)

        if (!local_content && remote_content)
        {
          writeFileSync(join(sums_dir, filename), remote_content, 'utf-8')
          result.new_from_remote.push(filename)
        }
        else if (local_content && !remote_content)
        {
          writeFileSync(join(sums_dir, filename), local_content, 'utf-8')
        }
        else if (local_content && remote_content)
        {
          const merged_content = merge_diary_manual_content(local_content, remote_content, filename)
          writeFileSync(join(sums_dir, filename), merged_content, 'utf-8')
          if (merged_content !== local_content)
          {
            result.merged_files.push(filename)
          }
        }
      }

      // Merge .json data files: UUID-keyed object merge
      const all_data_files = new Set([...data_snapshot.keys(), ...remote_data.keys()])
      for (const filename of all_data_files)
      {
        const local_content = data_snapshot.get(filename)
        const remote_content = remote_data.get(filename)

        if (local_content && remote_content)
        {
          try
          {
            const local_obj = JSON.parse(local_content)
            const remote_obj = JSON.parse(remote_content)
            // Union: remote keys + local keys (local overwrites same UUID)
            const merged_obj = { ...remote_obj, ...local_obj }
            writeFileSync(join(data_dir, filename), JSON.stringify(merged_obj, null, 2), 'utf-8')
          }
          catch
          {
            // Malformed JSON — keep local
            writeFileSync(join(data_dir, filename), local_content, 'utf-8')
          }
        }
        else if (local_content && !remote_content)
        {
          writeFileSync(join(data_dir, filename), local_content, 'utf-8')
        }
        else if (!local_content && remote_content)
        {
          writeFileSync(join(data_dir, filename), remote_content, 'utf-8')
        }
      }

      // Stage and commit
      this.ensure_gitignore()
      await g.add(['sums/', 'data/', '.gitignore'])

      const status = await g.status()
      if (status.files.length > 0)
      {
        await g.commit('sync: merge diary and session data')
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
