import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

export const buttonTheme = {
  radius: "9999px",
  paddingX: {
    sm: "px-3",
    md: "px-4",
    lg: "px-5",
  },
  height: {
    sm: "h-9",
    md: "h-10",
    lg: "h-11",
  },
  shadow: {
    primary: "shadow-[0_12px_32px_rgba(15,23,42,0.22)]",
    subtle: "shadow-[0_10px_26px_rgba(15,23,42,0.12)]",
    none: "shadow-none",
  },
} as const

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-tight transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]"

const buttonVariants = cva(
  buttonBase,
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 " +
          buttonTheme.shadow.primary,
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30 " +
          buttonTheme.shadow.primary,
        outline:
          "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground " +
          buttonTheme.shadow.subtle,
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 " +
          buttonTheme.shadow.subtle,
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground " +
          buttonTheme.shadow.none,
        link:
          "bg-transparent text-primary underline-offset-4 hover:underline hover:text-primary/90 " +
          buttonTheme.shadow.none,
      },
      size: {
        default: `${buttonTheme.height.md} ${buttonTheme.paddingX.md} has-[>svg]:px-3`,
        sm: `${buttonTheme.height.sm} ${buttonTheme.paddingX.sm} has-[>svg]:px-2.5`,
        lg: `${buttonTheme.height.lg} ${buttonTheme.paddingX.lg} has-[>svg]:px-4`,
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
