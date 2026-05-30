import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent, DragOverlay } from '@dnd-kit/core'
import { useState } from 'react'
import { TaskLibrary } from '../components/tasks/TaskLibrary'
import { TodayPanel } from '../components/tasks/TodayPanel'
import { FocusTimer } from '../components/timer/FocusTimer'
import { SessionConfig } from '../components/timer/SessionConfig'
import { useTodoStore } from '../store/useTodoStore'
import { useFocusStore } from '../store/useFocusStore'
import styles from './TodayPage.module.css'

export function TodayPage(): JSX.Element
{
  const { add_todo, reorder_todos, items } = useTodoStore()
  const set_subject = useFocusStore((s) => s.set_subject)
  const [drag_label, set_drag_label] = useState<string>('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  function handleDragStart(event: { active: { id: string; data: { current?: Record<string, unknown> } } })
  {
    const data = event.active.data.current
    if (data?.type === 'library')
    {
      set_drag_label((data.label as string) || 'Task')
    }
  }

  function handleDragEnd(event: DragEndEvent)
  {
    set_drag_label('')
    const { active, over } = event
    if (!over) return

    const active_data = active.data.current
    if (!active_data) return

    if (active_data.type === 'library' && typeof active_data.task_id === 'number')
    {
      const task_id = active_data.task_id as number
      const title = (active_data.label as string) || '未命名'
      add_todo(task_id, title).then(() =>
      {
        // Auto-set as focus subject — drag to today = start focusing on this
        set_subject(title)
      }).catch((err: Error) =>
      {
        console.error('add_todo failed:', err)
      })
      return
    }

    const over_id = String(over.id)
    if (active_data.type === 'todo' && over_id && over_id !== active.id)
    {
      const active_idx = items.findIndex((item) => `todo-${item.id}` === active.id)
      const over_idx = items.findIndex((item) => `todo-${item.id}` === over_id)
      if (active_idx !== -1 && over_idx !== -1 && active_idx !== over_idx)
      {
        const reordered = [...items]
        const [moved] = reordered.splice(active_idx, 1)
        reordered.splice(over_idx, 0, moved)
        reorder_todos(reordered.map((i) => i.id))
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.page}>
        <div className={styles.grid}>
          <div className={styles.library_section}>
            <h2 className={styles.section_title}>任务库</h2>
            <TaskLibrary />
          </div>
          <div className={styles.today_section}>
            <h2 className={styles.section_title}>今日计划</h2>
            <TodayPanel />
          </div>
          <div className={styles.timer_section}>
            <FocusTimer />
            <SessionConfig />
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {drag_label ? (
          <div className={styles.drag_overlay}>
            <span>{drag_label}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
