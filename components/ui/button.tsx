import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Charter buttons. Primary = evergreen with an inner highlight (actions only); secondary/outline =
 * panel with a hairline; ghost for toolbars. Height follows the density setting (h-control).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body-sm font-medium select-none transition-[background-color,box-shadow,color] duration-(--duration-fast) ease-out focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-button hover:bg-primary/92',
        default: 'bg-primary text-primary-foreground shadow-button hover:bg-primary/92',
        secondary: 'bg-card text-foreground shadow-[0_0_0_1px_var(--border-strong),var(--elevation-xs)] hover:bg-surface-sunken',
        outline: 'bg-card text-foreground shadow-[0_0_0_1px_var(--border-strong),var(--elevation-xs)] hover:bg-surface-sunken',
        ghost: 'text-foreground-secondary hover:bg-hover hover:text-foreground',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
        destructive: 'bg-destructive text-destructive-foreground shadow-button hover:bg-destructive/92',
      },
      size: {
        default: 'h-control px-3.5',
        sm: 'h-8 px-3 text-caption',
        lg: 'h-10 px-4 text-body',
        icon: 'size-(--control-height) p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
