
/**
 * @file Sidebar layout components
 * 
 * Contains layout components for structuring the sidebar:
 * - SidebarHeader: Top section of the sidebar
 * - SidebarFooter: Bottom section of the sidebar
 * - SidebarSeparator: Horizontal divider
 * - SidebarContent: Main content area with scrolling
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

/**
 * Sidebar header component
 * 
 * Used for the top section of the sidebar, typically contains
 * logo, app name, and possibly trigger button.
 */
export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

/**
 * Sidebar footer component
 * 
 * Used for the bottom section of the sidebar, typically contains
 * user info, logout button, etc.
 */
export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

/**
 * Sidebar separator component
 * 
 * A horizontal divider for the sidebar, styled to match the sidebar theme.
 */
export const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

/**
 * Sidebar content component
 * 
 * Main content area of the sidebar with scrolling capability.
 * Automatically handles overflow when content is too large.
 */
export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"
