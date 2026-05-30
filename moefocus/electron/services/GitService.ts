// ===== Phase 5: Git 同步服务 =====
// 基于 simple-git 封装 commit/push/pull/remote 操作
// Phase 5 实现日记自动提交; Phase 8 扩展双 PC 数据同步

import { simpleGit, type SimpleGit } from 'simple-git'
import { app } from 'electron'
import { join } from 'path'

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

  async commit(message: string): Promise<{ success: boolean; message?: string }>
  {
    try
    {
      const g = await this.get_git()
      await g.add('./*')
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

      // Check if already a git repo
      const is_repo = await g.checkIsRepo()
      if (!is_repo)
      {
        await g.init()
      }

      return { success: true }
    }
    catch (e)
    {
      return { success: false, error: String(e) }
    }
  }
}

export const git_service = new GitService()
