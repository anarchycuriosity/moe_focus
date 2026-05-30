import { useDraggable } from '@dnd-kit/core'
import styles from './TaskCard.module.css'

interface Props
{
  task: Task
  on_delete: (id: number) => void
}

export function TaskCard({ task, on_delete }: Props): JSX.Element
{
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${task.id}`,
    data: { type: 'library', task_id: task.id, label: task.title }
  })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <span className={styles.title}>{task.title}</span>
      <button
        className={styles.delete_btn}
        onClick={(e) =>
        {
          e.stopPropagation()
          on_delete(task.id)
        }}
        title="删除任务"
      >
        ×
      </button>
    </div>
  )
}
