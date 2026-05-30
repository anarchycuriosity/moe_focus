import { useState, useRef, useCallback } from 'react'
import styles from './PhotoFrame.module.css'

// Placeholder images for the photo frame
const default_images = [
  '🌸', '🐰', '☕', '🎀', '🍰', '💕'
]

interface Props
{
  enabled?: boolean
  position?: string
}

export function PhotoFrame({ enabled = true, position = 'bottom-right' }: Props): JSX.Element | null
{
  if (!enabled) return null

  const [image_index, set_image_index] = useState(0)
  const [pos, set_pos] = useState({ x: 0, y: 0 })
  const [is_dragging, set_is_dragging] = useState(false)
  const drag_offset = useRef({ x: 0, y: 0 })
  const frame_ref = useRef<HTMLDivElement>(null)

  const handle_mouse_down = useCallback((e: React.MouseEvent) =>
  {
    set_is_dragging(true)
    drag_offset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    }
    e.preventDefault()
  }, [pos])

  const handle_mouse_move = useCallback((e: React.MouseEvent) =>
  {
    if (!is_dragging) return
    set_pos({
      x: e.clientX - drag_offset.current.x,
      y: e.clientY - drag_offset.current.y
    })
  }, [is_dragging])

  const handle_mouse_up = useCallback(() =>
  {
    if (!is_dragging) return
    set_is_dragging(false)
  }, [is_dragging])

  const cycle_image = () =>
  {
    set_image_index((prev) => (prev + 1) % default_images.length)
  }

  const position_style: React.CSSProperties = is_dragging
    ? { left: pos.x, top: pos.y, cursor: 'grabbing' }
    : pos.x === 0 && pos.y === 0
      ? position === 'bottom-right'
        ? { bottom: '80px', right: '20px' }
        : { bottom: '80px', left: '20px' }
      : { left: pos.x, top: pos.y }

  return (
    <div
      ref={frame_ref}
      className={`${styles.frame} ${is_dragging ? styles.dragging : ''}`}
      style={{
        ...position_style,
        position: 'fixed',
        zIndex: 999
      }}
      onMouseDown={handle_mouse_down}
      onMouseMove={handle_mouse_move}
      onMouseUp={handle_mouse_up}
      onMouseLeave={handle_mouse_up}
      onClick={cycle_image}
      title="点击切换图片 | 可拖动位置"
    >
      <div className={styles.frame_border}>
        <div className={styles.frame_inner}>
          <span className={styles.frame_image}>
            {default_images[image_index]}
          </span>
        </div>
      </div>
      <div className={styles.frame_decor}>
        <span className={styles.ribbon}>🎗️</span>
      </div>
    </div>
  )
}
