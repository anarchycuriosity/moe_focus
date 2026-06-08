import { useState, useCallback } from 'react'
import dayjs from 'dayjs'
import { WeeklyChart } from './WeeklyChart'
import { MonthlyChart } from './MonthlyChart'
import { FocusBreakdown } from './FocusBreakdown'
import { MoeCard } from '../common/MoeCard'
import { MoeButton } from '../common/MoeButton'
import styles from './StatsDashboard.module.css'

type ViewMode = 'weekly' | 'monthly'
type ChartType = 'bar' | 'circle'
type SyncNoticeType = 'info' | 'success' | 'error'

interface SyncNotice
{
  type: SyncNoticeType
  text: string
}

export function StatsDashboard(): JSX.Element
{
  const [view, set_view] = useState<ViewMode>('weekly')
  const [chart_type, set_chart_type] = useState<ChartType>('bar')
  const [refresh_trigger, set_refresh_trigger] = useState(0)
  const [sync_notice, set_sync_notice] = useState<SyncNotice | null>(null)
  const [syncing, set_syncing] = useState(false)

  // Reference date controls which week/month we're viewing (navigable)
  const [ref_date, set_ref_date] = useState(dayjs())

  const navigate_week = useCallback((delta: number) =>
  {
    set_ref_date((d) => d.add(delta, 'week'))
  }, [])

  const navigate_month = useCallback((delta: number) =>
  {
    set_ref_date((d) => d.add(delta, 'month'))
  }, [])

  const go_to_current = useCallback(() =>
  {
    set_ref_date(dayjs())
  }, [])

  // Calculate dates from reference date
  const week_start = ref_date.startOf('week').add(1, 'day').format('YYYY-MM-DD')
  const week_end = ref_date.endOf('week').add(1, 'day').format('YYYY-MM-DD')
  const current_month = ref_date.format('YYYY-MM')
  const month_start = ref_date.startOf('month').format('YYYY-MM-DD')
  const month_end = ref_date.endOf('month').format('YYYY-MM-DD')
  const is_current = ref_date.isSame(dayjs(), view === 'weekly' ? 'week' : 'month')

  const handle_sync = async () =>
  {
    if (syncing) return
    set_syncing(true)
    set_sync_notice({ type: 'info', text: '正在同步数据，请稍等...' })
    try
    {
      // 1. Full git sync: import sessions from remote (JSON UUID dedup)
      const sync_result = await window.electronAPI.git.sync()
      if (!sync_result.success)
      {
        set_sync_notice({ type: 'error', text: `同步失败: ${sync_result.error || '未知错误'}` })
        return
      }

      // 2. Clean orphan sessions (sessions without matching diary entries)
      const cleanup = await window.electronAPI.stats.sync_cleanup()

      // 3. Build feedback message with diagnostic detail
      const parts: string[] = []
      if (sync_result.imported_sessions && sync_result.imported_sessions > 0)
        parts.push(`导入 ${sync_result.imported_sessions} 条会话`)
      if (sync_result.imported_goals && sync_result.imported_goals > 0)
        parts.push(`同步 ${sync_result.imported_goals} 条长期目标`)
      if (sync_result.diary_entries_synced && sync_result.diary_entries_synced > 0)
        parts.push(`同步 ${sync_result.diary_entries_synced} 天日记`)
      if (sync_result.new_from_remote.length > 0)
        parts.push(`新文件: ${sync_result.new_from_remote.join(', ')}`)
      if (cleanup.cleaned_sessions > 0)
        parts.push(`清理 ${cleanup.cleaned_sessions} 条孤儿记录`)
      if (cleanup.skipped && cleanup.reason)
        parts.push(`跳过清理: ${cleanup.reason}`)
      if (parts.length === 0)
        parts.push('数据已是最新 — 远程无新内容')
      set_sync_notice({ type: 'success', text: `同步成功: ${parts.join('，')}` })

      // 4. Refresh charts
      set_refresh_trigger((n) => n + 1)
    }
    catch (error)
    {
      const error_text = error instanceof Error ? error.message : '请检查网络和远程仓库配置'
      set_sync_notice({ type: 'error', text: `同步失败: ${error_text}` })
    }
    finally
    {
      set_syncing(false)
    }
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.controls}>
        <div className={styles.view_toggle}>
          <MoeButton
            variant={view === 'weekly' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => set_view('weekly')}
          >
            周视图
          </MoeButton>
          <MoeButton
            variant={view === 'monthly' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => set_view('monthly')}
          >
            月视图
          </MoeButton>
        </div>

        <div className={styles.chart_toggle}>
          <MoeButton
            variant={chart_type === 'bar' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => set_chart_type('bar')}
          >
            📊 柱状图
          </MoeButton>
          <MoeButton
            variant={chart_type === 'circle' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => set_chart_type('circle')}
          >
            🍩 饼图
          </MoeButton>
        </div>

        <MoeButton variant="ghost" size="sm" onClick={handle_sync} disabled={syncing}>
          {syncing ? '⏳ 同步中...' : '🔄 同步数据'}
        </MoeButton>
      </div>

      {sync_notice && (
        <div
          className={`${styles.sync_notice} ${styles[sync_notice.type]}`}
          role="status"
          aria-live="polite"
        >
          <span>{sync_notice.text}</span>
          {!syncing && (
            <button
              className={styles.sync_notice_close}
              onClick={() => set_sync_notice(null)}
              title="关闭同步提示"
            >
              x
            </button>
          )}
        </div>
      )}

      {/* Date navigation */}
      <div className={styles.date_nav}>
        <MoeButton variant="ghost" size="sm" onClick={() => view === 'weekly' ? navigate_week(-1) : navigate_month(-1)}>
          ◀
        </MoeButton>
        <span className={styles.date_display}>
          {view === 'weekly'
            ? `${week_start} ~ ${week_end}`
            : `${month_start} ~ ${month_end}`}
        </span>
        <MoeButton variant="ghost" size="sm" onClick={() => view === 'weekly' ? navigate_week(1) : navigate_month(1)}>
          ▶
        </MoeButton>
        {!is_current && (
          <MoeButton variant="ghost" size="sm" onClick={go_to_current}>
            今
          </MoeButton>
        )}
      </div>

      {chart_type === 'bar' ? (
        <MoeCard className={styles.chart_card}>
          {view === 'weekly' ? (
            <WeeklyChart week_start={week_start} chart_type="bar" refresh_trigger={refresh_trigger} />
          ) : (
            <MonthlyChart month={current_month} chart_type="bar" refresh_trigger={refresh_trigger} />
          )}
        </MoeCard>
      ) : (
        <MoeCard className={styles.chart_card}>
          <h3 className={styles.chart_title}>专注事项分布</h3>
          <FocusBreakdown
            start_date={view === 'weekly' ? week_start : month_start}
            end_date={view === 'weekly' ? week_end : month_end}
            refresh_trigger={refresh_trigger}
          />
        </MoeCard>
      )}
    </div>
  )
}
