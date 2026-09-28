import * as React from "react"

import { cn } from "../lib/cn"
import { controlClasses } from "./control"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(controlClasses, "flex min-h-[84px] resize-y py-2.5 text-base leading-relaxed md:text-sm", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
