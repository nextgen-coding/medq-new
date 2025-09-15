
/**
 * @file Sidebar inset content area
 * 
 * Renders a main content area that adapts to the sidebar's state.
 * This component is used to create layouts where the main content
 * area adjusts based on the sidebar's visibility.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Sidebar inset component
 * 
 * Renders a main content area that adapts to the sidebar's state.
 * Used to create responsive layouts with proper spacing around the content.
 */
export const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background",
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"
