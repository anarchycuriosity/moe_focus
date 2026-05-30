import { type InputHTMLAttributes, forwardRef } from 'react'
import styles from './MoeInput.module.css'
import clsx from 'clsx'

interface Props extends InputHTMLAttributes<HTMLInputElement>
{
  label?: string
}

export const MoeInput = forwardRef<HTMLInputElement, Props>(
  function MoeInput({ label, className, id, ...props }, ref)
  {
    const input_id = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={styles.wrapper}>
        {label && (
          <label className={styles.label} htmlFor={input_id}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={input_id}
          className={clsx(styles.input, className)}
          {...props}
        />
      </div>
    )
  }
)
