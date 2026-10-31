import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-blue-900 text-white hover:bg-blue-800 border border-blue-900 shadow-xs",
        default:
          "bg-blue-900 text-white hover:bg-blue-800 border border-blue-900 shadow-xs",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        outline:
          "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
        destructive:
          "bg-red-700 text-white hover:bg-red-800 border border-red-700",
      },
      size: {
        default: "h-8 px-3 py-1.5 text-xs",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
