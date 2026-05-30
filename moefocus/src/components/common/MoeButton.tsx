import { type ButtonHTMLAttributes } from 'react'
import styles from './MoeButton.module.css'
import clsx from 'clsx'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement>
{
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function MoeButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: Props): JSX.Element
{
  return (
    <button
      className={clsx(
        styles.btn,
        styles[variant],
        styles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
