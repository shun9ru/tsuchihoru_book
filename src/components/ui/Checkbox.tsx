import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string | ReactNode
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, id, ...rest }, ref) => {
    const checkboxId = id || (typeof label === 'string' ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

    return (
      <div className={cn('w-full', className)}>
        <label
          htmlFor={checkboxId}
          className="inline-flex cursor-pointer items-center gap-2"
        >
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            {...rest}
          />
          {label && (
            <span className="text-sm text-gray-700">{label}</span>
          )}
        </label>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'
