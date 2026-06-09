import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from './Sidebar.module.css'

interface NavItem
{
  path: string
  icon: string
  label: string
}

const nav_items: NavItem[] = [
  { path: '/', icon: '📋', label: '今日' },
  { path: '/diary', icon: '📔', label: '日记' },
  { path: '/long-term-tasks', icon: '🎯', label: '长期' },
  { path: '/statistics', icon: '📊', label: '统计' },
  { path: '/settings', icon: '⚙️', label: '设置' }
]

type SyncNoticeType = 'info' | 'success' | 'error'

interface SyncNotice
{
  type: SyncNoticeType
  text: string
}

export function Sidebar(): JSX.Element
{
  const location = useLocation()
  const [syncing, set_syncing] = useState(false)
  const [sync_notice, set_sync_notice] = useState<SyncNotice | null>(null)

  const format_sync_result = (result: Awaited<ReturnType<typeof window.electronAPI.git.sync>>): string =>
  {
    const parts: string[] = []
    if (result.remote_sums_count && result.remote_sums_count > 0)
      parts.push(`远程日记 ${result.remote_sums_count} 篇`)
    if (result.remote_data_count && result.remote_data_count > 0)
      parts.push(`远程数据 ${result.remote_data_count} 文件`)
    if (result.imported_sessions && result.imported_sessions > 0)
      parts.push(`新会话 ${result.imported_sessions} 条`)
    if (result.imported_goals && result.imported_goals > 0)
      parts.push(`长期任务 ${result.imported_goals} 条`)
    if (result.merged_files.length > 0)
      parts.push(`合并反思 ${result.merged_files.length} 篇`)
    if (result.diary_entries_synced && result.diary_entries_synced > 0)
      parts.push(`日记 ${result.diary_entries_synced} 天`)
    if (result.new_from_remote.length > 0)
      parts.push(`新文件 ${result.new_from_remote.length} 个`)
    if (parts.length === 0)
      parts.push('数据已是最新')
    return parts.join('，')
  }

  const handle_sync = async () =>
  {
    if (syncing) return
    set_syncing(true)
    set_sync_notice({ type: 'info', text: '同步中...' })
    try
    {
      const result = await window.electronAPI.git.sync()
      if (result.success)
      {
        set_sync_notice({ type: 'success', text: `同步成功：${format_sync_result(result)}` })
      }
      else
      {
        set_sync_notice({ type: 'error', text: `同步失败：${result.error || '未知错误'}` })
      }
    }
    catch (error)
    {
      const error_text = error instanceof Error ? error.message : '未知错误'
      set_sync_notice({ type: 'error', text: `同步异常：${error_text}` })
    }
    finally
    {
      set_syncing(false)
    }
  }

  return (
    <nav className={styles.sidebar}>
      <div className={styles.nav_items}>
        {nav_items.map((item) =>
        {
          const is_active = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`${styles.nav_item} ${is_active ? styles.active : ''}`}
            >
              <span className={styles.nav_icon}>{item.icon}</span>
              <span className={styles.nav_label}>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
      <div className={styles.sidebar_footer}>
        <button
          className={`${styles.sync_btn} ${syncing ? styles.syncing : ''}`}
          onClick={handle_sync}
          title={sync_notice?.text || '一键同步数据'}
          disabled={syncing}
        >
          <span className={styles.sync_icon}>{syncing ? '⏳' : '🔄'}</span>
        </button>
      </div>
      {sync_notice && (
        <div className={`${styles.sync_notice} ${styles[sync_notice.type]}`} role="status">
          <span>{sync_notice.text}</span>
          {!syncing && (
            <button onClick={() => set_sync_notice(null)} title="关闭同步提示">x</button>
          )}
        </div>
      )}
    </nav>
  )
}

// 暴露同步接口到 GUI 以外，方便在 DevTools console 直接测试
if (typeof window !== 'undefined')
{
  ;(window as unknown as Record<string, unknown>).__moe_sync__ = async () =>
  {
    const api = (window as unknown as Record<string, { git: { sync: () => Promise<unknown> } }>).electronAPI
    if (!api)
    {
      console.error('electronAPI not available')
      return
    }
    console.log('[moe_sync] starting sync...')
    const result = await api.git.sync()
    console.log('[moe_sync] result:', result)
    return result
  }
  console.log('[MoeFocus] 同步测试接口已就绪: await window.__moe_sync__()')
}
