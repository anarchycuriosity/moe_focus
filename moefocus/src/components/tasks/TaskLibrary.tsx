import { useEffect, useState } from 'react'
import { useTaskStore } from '../../store/useTaskStore'
import { TaskCard } from './TaskCard'
import { MoeCard } from '../common/MoeCard'
import { MoeButton } from '../common/MoeButton'
import { MoeInput } from '../common/MoeInput'
import styles from './TaskLibrary.module.css'

export function TaskLibrary(): JSX.Element
{
  const { tasks, load_tasks, add_task, remove_task } = useTaskStore()
  const [show_form, set_show_form] = useState(false)
  const [new_title, set_new_title] = useState('')

  useEffect(() =>
  {
    load_tasks()
  }, []) // load_tasks is stable from Zustand, no need for deps

  const handle_add = async () =>
  {
    const trimmed = new_title.trim()
    if (trimmed)
    {
      try
      {
        await add_task(trimmed)
        set_new_title('')
        set_show_form(false)
      }
      catch (err)
      {
        console.error('Failed to add task:', err)
      }
    }
  }

  return (
    <MoeCard className={styles.library}>
      <div className={styles.header}>
        <span className={styles.header_title}>预设任务</span>
        <MoeButton
          variant="ghost"
          size="sm"
          onClick={() => set_show_form(!show_form)}
        >
          {show_form ? '取消' : '+ 添加'}
        </MoeButton>
      </div>

      {show_form && (
        <div className={styles.form}>
          <MoeInput
            placeholder="输入任务名称..."
            value={new_title}
            onChange={(e) => set_new_title(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handle_add()}
          />
          <MoeButton variant="primary" size="sm" onClick={handle_add}>
            确认
          </MoeButton>
        </div>
      )}

      <div className={styles.task_list}>
        {tasks.length === 0 ? (
          <p className={styles.empty}>
            还没有预设任务。
            <br />
            点击 "+ 添加" 来创建你的第一个任务。
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} on_delete={remove_task} />
          ))
        )}
      </div>

      <p className={styles.hint}>
        拖拽任务到中间的「今日计划」即可添加到今日 TODO
      </p>
    </MoeCard>
  )
}
