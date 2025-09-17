"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// Lightweight ScrollArea fallback to avoid complex state loops.
// Provides a drop-in replacement API for our use cases.
const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
      <div className="h-full w-full rounded-[inherit] overflow-auto custom-scrollbar">
        {children}
      </div>
    </div>
  )
)
ScrollArea.displayName = "ScrollArea"

// No-op ScrollBar to keep named export compatibility if ever imported directly.
const ScrollBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("hidden", className)} {...props} />
  )
)
ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }
