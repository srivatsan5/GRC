import * as React from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full min-w-0 rounded-md border border-input bg-card px-3 text-body text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-(--duration-fast) ease-out outline-none focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--selection)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_18%,transparent)]'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldBase, 'h-control py-0 file:mr-3 file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-foreground', className)}
      {...props}
    />
  )
}

export { Input, fieldBase }
