import { useEffect, useState } from 'react'
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

interface LongTermGoal
{
  uuid: string
  title: string
  deadline: string | null
  status: 'active' | 'done'
}

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
  const [goals_open, set_goals_open] = useState(false)
  const [goals, set_goals] = useState<LongTermGoal[]>([])
  const [new_goal_title, set_new_goal_title] = useState('')
  const [new_goal_deadline, set_new_goal_deadline] = useState('')

  useEffect(() =>
  {
    load_goals()
  }, [])

  const load_goals = async () =>
  {
    const rows = await window.electronAPI.long_term_goals.list()
    set_goals(rows as LongTermGoal[])
  }

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
      parts.push(`长期目标 ${result.imported_goals} 条`)
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
        await load_goals()
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

  const handle_create_goal = async () =>
  {
    const title = new_goal_title.trim()
    if (!title) return

    await window.electronAPI.long_term_goals.create({
      title,
      deadline: new_goal_deadline || null
    })
    set_new_goal_title('')
    set_new_goal_deadline('')
    await load_goals()
  }

  const handle_toggle_goal = async (goal: LongTermGoal) =>
  {
    await window.electronAPI.long_term_goals.update(goal.uuid, {
      status: goal.status === 'done' ? 'active' : 'done'
    })
    await load_goals()
  }

  const handle_delete_goal = async (uuid: string) =>
  {
    await window.electronAPI.long_term_goals.remove(uuid)
    await load_goals()
  }

  const get_deadline_label = (deadline: string | null): string =>
  {
    if (!deadline) return '无截止日期'
    const today = new Date()
    const target = new Date(`${deadline}T00:00:00`)
    today.setHours(0, 0, 0, 0)
    const diff_days = Math.ceil((target.getTime() - today.getTime()) / 86400000)
    if (diff_days < 0) return `已逾期 ${Math.abs(diff_days)} 天`
    if (diff_days === 0) return '今天截止'
    return `${diff_days} 天后截止`
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
      <div className={styles.goal_module}>
        <button
          className={`${styles.goal_btn} ${goals_open ? styles.active_goal_btn : ''}`}
          onClick={() => set_goals_open((open) => !open)}
          title="长期目标"
        >
          <span className={styles.goal_icon}>🎯</span>
          {goals.filter((goal) => goal.status !== 'done').length > 0 && (
            <span className={styles.goal_badge}>
              {goals.filter((goal) => goal.status !== 'done').length}
            </span>
          )}
        </button>

        {goals_open && (
          <section className={styles.goal_panel} aria-label="长期目标">
            <div className={styles.goal_panel_header}>
              <strong>长期目标</strong>
              <button onClick={() => set_goals_open(false)} title="关闭长期目标">x</button>
            </div>
            <div className={styles.goal_form}>
              <input
                value={new_goal_title}
                onChange={(event) => set_new_goal_title(event.target.value)}
                placeholder="目标名称"
              />
              <input
                type="date"
                value={new_goal_deadline}
                onChange={(event) => set_new_goal_deadline(event.target.value)}
              />
              <button onClick={handle_create_goal}>添加</button>
            </div>
            <div className={styles.goal_table}>
              {goals.length === 0 ? (
                <p className={styles.goal_empty}>暂无长期目标</p>
              ) : (
                goals.map((goal) => (
                  <div key={goal.uuid} className={`${styles.goal_row} ${goal.status === 'done' ? styles.goal_done : ''}`}>
                    <button
                      className={styles.goal_check}
                      onClick={() => handle_toggle_goal(goal)}
                      title={goal.status === 'done' ? '标记为进行中' : '标记完成'}
                    >
                      {goal.status === 'done' ? '✓' : ''}
                    </button>
                    <div className={styles.goal_text}>
                      <span>{goal.title}</span>
                      <small>{goal.deadline || '未设置'} · {get_deadline_label(goal.deadline)}</small>
                    </div>
                    <button
                      className={styles.goal_delete}
                      onClick={() => handle_delete_goal(goal.uuid)}
                      title="删除长期目标"
                    >
                      x
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
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
