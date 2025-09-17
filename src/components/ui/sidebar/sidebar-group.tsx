
/**
 * @file Sidebar group components
 * 
 * Contains components for creating and structuring groups within the sidebar:
 * - SidebarGroup: Container for a group of related items
 * - SidebarGroupLabel: Label/heading for a group
 * - SidebarGroupAction: Action button for the group (e.g., add, edit)
 * - SidebarGroupContent: Content container for the group
 */

import * as React from "react"
// Removed Radix Slot to prevent infinite loops
import { cn } from "@/lib/utils"

/**
 * Sidebar group component
 * 
 * Container for a group of related items within the sidebar.
 * Usually contains a label, content, and optional action button.
 */
export const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

/**
 * Sidebar group label component
 * 
 * Label/heading for a group of items within the sidebar.
 * Supports asChild to allow custom elements as labels.
 */
export const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, children, ...props }, ref) => {
  // Simple implementation without Slot to prevent infinite loops
  if (asChild && React.isValidElement(children)) {
    // Cast to any to avoid strict prop mismatch for custom elements; data attributes are valid on DOM nodes
    const child: any = children;
    return React.cloneElement(child, {
      ...props,
      // Use data attribute via prop (valid on intrinsic elements). If custom component, it's passed through.
      'data-sidebar': 'group-label',
      className: cn(
        "duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
        child.props.className
      ),
    })
  }

  return (
    <div
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

/**
 * Sidebar group action component
 * 
 * Action button for a sidebar group, positioned in the top-right corner.
 * Commonly used for adding, editing, or managing group items.
 */
export const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, children, ...props }, ref) => {
  // Simple implementation without Slot to prevent infinite loops
  if (asChild && React.isValidElement(children)) {
    const child: any = children;
    return React.cloneElement(child, {
      ...props,
      'data-sidebar': 'group-action',
      className: cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
        child.props.className
      ),
    })
  }

  return (
    <button
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

/**
 * Sidebar group content component
 * 
 * Container for the content of a sidebar group.
 */
export const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"
