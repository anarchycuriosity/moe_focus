interface Props
{
  remaining_seconds: number
  total_seconds: number
  size?: number
  stroke_width?: number
  phase: 'focus' | 'rest' | 'idle' | 'paused' | 'completed'
}

export function CircularProgress({
  remaining_seconds,
  total_seconds,
  size = 180,
  stroke_width = 6,
  phase
}: Props): JSX.Element
{
  const radius = (size - stroke_width) / 2
  const circumference = radius * 2 * Math.PI
  const progress = total_seconds > 0 ? remaining_seconds / total_seconds : 0
  const offset = circumference * (1 - progress)

  const minutes = Math.floor(remaining_seconds / 60)
  const seconds = remaining_seconds % 60
  const time_str = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const is_running = phase === 'focus' || phase === 'rest'
  const color = phase === 'rest'
    ? 'var(--moe-mint)'
    : 'var(--moe-pink)'

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--moe-border)"
          strokeWidth={stroke_width}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke_width}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease',
            filter: is_running ? `drop-shadow(0 0 6px ${color})` : 'none'
          }}
        />
      </svg>

      {/* Center text */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span
          style={{
            fontSize: size > 160 ? '36px' : '28px',
            fontWeight: 700,
            color: 'var(--moe-text)',
            letterSpacing: '1px',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {time_str}
        </span>
        <span
          style={{
            fontSize: '13px',
            color: 'var(--moe-text-light)',
            fontWeight: 500
          }}
        >
          {phase === 'focus' ? '专注中' : phase === 'rest' ? '休息中' : phase === 'paused' ? '已暂停' : ''}
        </span>
      </div>
    </div>
  )
}
