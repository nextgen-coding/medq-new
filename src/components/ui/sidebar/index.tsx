
/**
 * @file Sidebar component index file
 * 
 * This file exports all sidebar components and provides the main entry point
 * for the sidebar component library. It wraps the SidebarProvider with a
 * TooltipProvider to ensure tooltips work correctly for collapsed sidebars.
 */

import * as React from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SidebarProvider, useSidebar } from "./sidebar-context"
import { Sidebar } from "./sidebar"
import { SidebarTrigger } from "./sidebar-trigger"
import { SidebarRail } from "./sidebar-rail"
import { SidebarInset } from "./sidebar-inset"
import { SidebarInput } from "./sidebar-input"
import {
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarContent
} from "./sidebar-layout"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent
} from "./sidebar-group"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton
} from "./sidebar-menu"
import {
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
} from "./sidebar-submenu"

/**
 * Enhanced SidebarProvider that wraps the original provider with TooltipProvider
 * for better tooltip integration with sidebar components.
 */
const EnhancedSidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SidebarProvider>
>(({ className, children, ...props }, ref) => {
  return (
    <SidebarProvider
      ref={ref}
      className={cn(
        "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
        className
      )}
      {...props}
    >
      <TooltipProvider delayDuration={0}>
        {children}
      </TooltipProvider>
    </SidebarProvider>
  )
})
EnhancedSidebarProvider.displayName = "SidebarProvider"

export {
  EnhancedSidebarProvider as SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
