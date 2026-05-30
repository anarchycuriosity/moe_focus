import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './TodayTaskItem.module.css'

interface Props
{
  item: TodoItem
  on_toggle_done: (id: number) => void
  on_remove: (id: number) => void
}

export function TodayTaskItem({ item, on_toggle_done, on_remove }: Props): JSX.Element
{
  if (!item || item.id == null) return <></>

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `todo-${item.id}`,
    data: { type: 'todo', item }
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: item.task_color || '#FFB7C5'
  }

  const is_done = item.status === 'done'

  return (
    <div
      ref={setNodeRef}
      className={`${styles.item} ${is_done ? styles.done : ''} ${isDragging ? styles.dragging : ''}`}
      style={style}
    >
      <button
        className={styles.drag_handle}
        {...listeners}
        {...attributes}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="5" cy="3" r="1.2" />
          <circle cx="9" cy="3" r="1.2" />
          <circle cx="5" cy="7" r="1.2" />
          <circle cx="9" cy="7" r="1.2" />
          <circle cx="5" cy="11" r="1.2" />
          <circle cx="9" cy="11" r="1.2" />
        </svg>
      </button>

      <button
        className={`${styles.checkbox} ${is_done ? styles.checked : ''}`}
        onClick={() => on_toggle_done(item.id)}
      >
        {is_done ? '✓' : ''}
      </button>

      <span className={`${styles.title} ${is_done ? styles.title_done : ''}`}>
        {item.custom_title || item.task_title || '未命名任务'}
      </span>

      <button
        className={styles.remove_btn}
        onClick={() => on_remove(item.id)}
        title="删除"
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
