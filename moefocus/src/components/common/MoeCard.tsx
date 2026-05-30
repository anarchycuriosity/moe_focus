import { type HTMLAttributes, forwardRef } from 'react'
import styles from './MoeCard.module.css'
import clsx from 'clsx'

interface Props extends HTMLAttributes<HTMLDivElement>
{
  variant?: 'elevated' | 'flat'
}

export const MoeCard = forwardRef<HTMLDivElement, Props>(
  function MoeCard({ variant = 'elevated', className, children, ...props }, ref)
  {
    return (
      <div
        ref={ref}
        className={clsx(styles.card, styles[variant], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
