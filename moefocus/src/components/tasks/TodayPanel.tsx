import { useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useTodoStore } from '../../store/useTodoStore'
import { TodayTaskItem } from './TodayTaskItem'
import { MoeCard } from '../common/MoeCard'
import styles from './TodayPanel.module.css'

export function TodayPanel(): JSX.Element
{
  const { items, load_todos, toggle_done, remove_todo } = useTodoStore()

  const { setNodeRef, isOver } = useDroppable({
    id: 'today-panel',
    data: { type: 'drop-zone' }
  })

  useEffect(() =>
  {
    load_todos()
  }, [])

  const valid_items = items.filter((item) => item && item.id != null)
  const sortable_ids = valid_items.map((item) => `todo-${item.id}`)

  return (
    <MoeCard
      className={`${styles.panel} ${isOver ? styles.over : ''}`}
      ref={setNodeRef}
    >
      <div className={styles.header}>
        <span className={styles.header_title}>今日计划</span>
        <span className={styles.count}>{valid_items.length} 项</span>
      </div>

      <div className={styles.list}>
        {items.length === 0 ? (
          <div className={styles.empty_state}>
            <span className={styles.empty_icon}>📥</span>
            <p>将左侧任务库中的项目拖拽到此处</p>
          </div>
        ) : (
          <SortableContext items={sortable_ids} strategy={verticalListSortingStrategy}>
            {valid_items.map((item) => (
              <TodayTaskItem
                key={item.id}
                item={item}
                on_toggle_done={toggle_done}
                on_remove={remove_todo}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </MoeCard>
  )
}
