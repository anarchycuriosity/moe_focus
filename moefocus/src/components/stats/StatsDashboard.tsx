import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { WeeklyChart } from './WeeklyChart'
import { MonthlyChart } from './MonthlyChart'
import { FocusBreakdown } from './FocusBreakdown'
import { MoeCard } from '../common/MoeCard'
import { MoeButton } from '../common/MoeButton'
import styles from './StatsDashboard.module.css'

type ViewMode = 'weekly' | 'monthly'
type ChartType = 'bar' | 'circle'

export function StatsDashboard(): JSX.Element
{
  const [view, set_view] = useState<ViewMode>('weekly')
  const [chart_type, set_chart_type] = useState<ChartType>('bar')
  const [refresh_trigger, set_refresh_trigger] = useState(0)
  const [sync_msg, set_sync_msg] = useState<string | null>(null)
  const [syncing, set_syncing] = useState(false)

  // Calculate current week start (Monday)
  const today = dayjs()
  const week_start = today.startOf('week').add(1, 'day').format('YYYY-MM-DD')
  const current_month = today.format('YYYY-MM')

  const handle_sync = async () =>
  {
    if (syncing) return
    set_syncing(true)
    set_sync_msg(null)
    try
    {
      // 1. Full git sync: import sessions from remote (JSON UUID dedup)
      const sync_result = await window.electronAPI.git.sync()
      if (!sync_result.success)
      {
        set_sync_msg(`同步失败: ${sync_result.error || '未知错误'}`)
        return
      }

      // 2. Clean orphan sessions (sessions without matching diary entries)
      const cleanup = await window.electronAPI.stats.sync_cleanup()

      // 3. Build feedback message
      const parts: string[] = []
      if (sync_result.imported_sessions)
      {
        parts.push(`导入 ${sync_result.imported_sessions} 条会话`)
      }
      if (cleanup.cleaned_sessions > 0)
      {
        parts.push(`清理 ${cleanup.cleaned_sessions} 条孤儿记录`)
      }
      if (parts.length === 0)
      {
        parts.push('数据已是最新')
      }
      set_sync_msg(parts.join('，'))

      // 4. Refresh charts
      set_refresh_trigger((n) => n + 1)
    }
    catch
    {
      set_sync_msg('同步失败，请检查网络和远程仓库配置')
    }
    finally
    {
      set_syncing(false)
      setTimeout(() => set_sync_msg(null), 5000)
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

      {sync_msg && (
        <div
          style={{
            textAlign: 'center',
            padding: '8px 16px',
            marginBottom: '8px',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--moe-text)',
            background: 'var(--moe-glass-bg)',
            border: '1px solid var(--moe-glass-border)'
          }}
        >
          {sync_msg}
        </div>
      )}

      <MoeCard className={styles.chart_card}>
        {view === 'weekly' ? (
          <WeeklyChart week_start={week_start} chart_type={chart_type} refresh_trigger={refresh_trigger} />
        ) : (
          <MonthlyChart month={current_month} chart_type={chart_type} refresh_trigger={refresh_trigger} />
        )}
      </MoeCard>

      <MoeCard className={styles.chart_card}>
        <h3 className={styles.chart_title}>专注事项分布</h3>
        <FocusBreakdown week_start={week_start} refresh_trigger={refresh_trigger} />
      </MoeCard>
    </div>
  )
}
