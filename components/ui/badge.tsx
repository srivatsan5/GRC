import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex h-badge items-center justify-center gap-1 rounded-sm px-2 text-caption font-medium whitespace-nowrap shrink-0 [&>svg]:size-3.5 [&>svg]:pointer-events-none focus-ring',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-[inset_0_0_0_1px_var(--border)]',
        destructive: 'bg-status-danger-bg text-status-danger-fg',
        outline: 'text-foreground-secondary shadow-[inset_0_0_0_1px_var(--border-strong)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({ className, variant, asChild = false, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
