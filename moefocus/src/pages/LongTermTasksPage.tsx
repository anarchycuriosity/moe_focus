import { useEffect, useMemo, useState } from 'react'
import { MoeButton } from '../components/common/MoeButton'
import { MoeCard } from '../components/common/MoeCard'
import styles from './LongTermTasksPage.module.css'

interface LongTermTask
{
  uuid: string
  title: string
  deadline: string | null
  status: 'active' | 'done'
  created_at: string
  updated_at: string
}

type TaskFilter = 'active' | 'all' | 'done'

export function LongTermTasksPage(): JSX.Element
{
  const [tasks, set_tasks] = useState<LongTermTask[]>([])
  const [title, set_title] = useState('')
  const [deadline, set_deadline] = useState('')
  const [filter, set_filter] = useState<TaskFilter>('active')
  const [loading, set_loading] = useState(true)
  const [saving, set_saving] = useState(false)

  useEffect(() =>
  {
    load_tasks()
  }, [])

  const load_tasks = async () =>
  {
    const rows = await window.electronAPI.long_term_goals.list()
    set_tasks(rows as LongTermTask[])
    set_loading(false)
  }

  const active_count = tasks.filter((task) => task.status !== 'done').length
  const done_count = tasks.filter((task) => task.status === 'done').length
  const overdue_count = tasks.filter((task) => task.status !== 'done' && get_deadline_days(task.deadline) < 0).length

  const filtered_tasks = useMemo(() =>
  {
    if (filter === 'active') return tasks.filter((task) => task.status !== 'done')
    if (filter === 'done') return tasks.filter((task) => task.status === 'done')
    return tasks
  }, [filter, tasks])

  const handle_create = async () =>
  {
    const task_title = title.trim()
    if (!task_title || saving) return

    set_saving(true)
    await window.electronAPI.long_term_goals.create({
      title: task_title,
      deadline: deadline || null
    })
    set_title('')
    set_deadline('')
    await load_tasks()
    set_saving(false)
  }

  const handle_toggle = async (task: LongTermTask) =>
  {
    await window.electronAPI.long_term_goals.update(task.uuid, {
      status: task.status === 'done' ? 'active' : 'done'
    })
    await load_tasks()
  }

  const handle_delete = async (uuid: string) =>
  {
    await window.electronAPI.long_term_goals.remove(uuid)
    await load_tasks()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>长期任务</h2>
          <p className={styles.subtitle}>把跨周、跨月的任务放在这里，截止日期会随同步一起保存。</p>
        </div>
      </div>

      <div className={styles.summary_grid}>
        <MoeCard className={styles.summary_card}>
          <span>进行中</span>
          <strong>{active_count}</strong>
        </MoeCard>
        <MoeCard className={styles.summary_card}>
          <span>已逾期</span>
          <strong>{overdue_count}</strong>
        </MoeCard>
        <MoeCard className={styles.summary_card}>
          <span>已完成</span>
          <strong>{done_count}</strong>
        </MoeCard>
      </div>

      <MoeCard className={styles.form_card}>
        <input
          value={title}
          onChange={(event) => set_title(event.target.value)}
          placeholder="输入长期任务，例如：完成 CS61A 第一轮学习"
          className={styles.title_input}
        />
        <input
          type="date"
          value={deadline}
          onChange={(event) => set_deadline(event.target.value)}
          className={styles.deadline_input}
        />
        <MoeButton size="sm" onClick={handle_create} disabled={saving || !title.trim()}>
          {saving ? '添加中...' : '添加任务'}
        </MoeButton>
      </MoeCard>

      <div className={styles.toolbar}>
        <button className={filter === 'active' ? styles.active_filter : ''} onClick={() => set_filter('active')}>
          进行中
        </button>
        <button className={filter === 'all' ? styles.active_filter : ''} onClick={() => set_filter('all')}>
          全部
        </button>
        <button className={filter === 'done' ? styles.active_filter : ''} onClick={() => set_filter('done')}>
          已完成
        </button>
      </div>

      <MoeCard className={styles.list_card}>
        {loading ? (
          <p className={styles.empty}>加载中...</p>
        ) : filtered_tasks.length === 0 ? (
          <p className={styles.empty}>暂无长期任务</p>
        ) : (
          <div className={styles.task_list}>
            {filtered_tasks.map((task) =>
            {
              const days = get_deadline_days(task.deadline)
              const deadline_state = get_deadline_state(days, task.status)
              return (
                <div key={task.uuid} className={`${styles.task_row} ${task.status === 'done' ? styles.done : ''}`}>
                  <button
                    className={styles.check_btn}
                    onClick={() => handle_toggle(task)}
                    title={task.status === 'done' ? '恢复为进行中' : '标记完成'}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                  <div className={styles.task_main}>
                    <strong>{task.title}</strong>
                    <span>{format_deadline(task.deadline, days)}</span>
                  </div>
                  <span className={`${styles.deadline_badge} ${styles[deadline_state]}`}>
                    {get_deadline_label(task.deadline, days, task.status)}
                  </span>
                  <button
                    className={styles.delete_btn}
                    onClick={() => handle_delete(task.uuid)}
                    title="删除任务"
                  >
                    删除
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </MoeCard>
    </div>
  )
}

function get_deadline_days(deadline: string | null): number
{
  if (!deadline) return Number.POSITIVE_INFINITY
  const today = new Date()
  const target = new Date(`${deadline}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function format_deadline(deadline: string | null, days: number): string
{
  if (!deadline) return '未设置截止日期'
  if (days < 0) return `${deadline} 截止，已逾期 ${Math.abs(days)} 天`
  if (days === 0) return `${deadline} 截止，也就是今天`
  return `${deadline} 截止，剩余 ${days} 天`
}

function get_deadline_label(deadline: string | null, days: number, status: string): string
{
  if (status === 'done') return '已完成'
  if (!deadline) return '无截止'
  if (days < 0) return '逾期'
  if (days <= 3) return '临近'
  return '正常'
}

function get_deadline_state(days: number, status: string): string
{
  if (status === 'done') return 'state_done'
  if (days < 0) return 'state_overdue'
  if (days <= 3) return 'state_soon'
  return 'state_normal'
}
