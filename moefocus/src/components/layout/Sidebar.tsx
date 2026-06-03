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
  { path: '/statistics', icon: '📊', label: '统计' },
  { path: '/settings', icon: '⚙️', label: '设置' }
]

export function Sidebar(): JSX.Element
{
  const location = useLocation()
  const [syncing, set_syncing] = useState(false)
  const [sync_tooltip, set_sync_tooltip] = useState('')

  const handle_sync = async () =>
  {
    if (syncing) return
    set_syncing(true)
    set_sync_tooltip('同步中...')
    try
    {
      const result = await window.electronAPI.git.sync()
      if (result.success)
      {
        const parts: string[] = []
        // 客观反馈：展示从远程实际拉取和导入的数量
        if (result.remote_sums_count && result.remote_sums_count > 0)
          parts.push(`远程日记: ${result.remote_sums_count} 篇`)
        if (result.remote_data_count && result.remote_data_count > 0)
          parts.push(`远程数据: ${result.remote_data_count} 文件`)
        if (result.imported_sessions && result.imported_sessions > 0)
          parts.push(`新会话: ${result.imported_sessions} 条`)
        if (result.diary_entries_synced && result.diary_entries_synced > 0)
          parts.push(`已同步: ${result.diary_entries_synced} 天日记`)
        if (result.new_from_remote.length > 0)
          parts.push(`新文件: ${result.new_from_remote.join(', ')}`)
        if (parts.length === 0)
          parts.push('数据已是最新 (远程无新内容)')
        set_sync_tooltip(parts.join('\n'))
      }
      else
      {
        set_sync_tooltip(`失败: ${result.error || '未知错误'}`)
      }
    }
    catch
    {
      set_sync_tooltip('同步异常')
    }
    finally
    {
      set_syncing(false)
      setTimeout(() => set_sync_tooltip(''), 3000)
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
          title={sync_tooltip || '一键同步数据'}
          disabled={syncing}
        >
          <span className={styles.sync_icon}>{syncing ? '⏳' : '🔄'}</span>
        </button>
      </div>
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
