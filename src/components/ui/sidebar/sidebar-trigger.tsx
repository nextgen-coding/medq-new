
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSidebar } from "./sidebar-context"
import { useTranslation } from "react-i18next"

/**
 * Sidebar trigger button
 * 
 * Renders a button that toggles the sidebar state when clicked.
 * Uses direction-appropriate chevron icons based on sidebar state.
 * Positioned to remain accessible regardless of sidebar state.
 */
export const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, state } = useSidebar()
  const { t } = useTranslation()

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent event propagation to avoid double triggering
    event.stopPropagation();
    onClick?.(event);
    toggleSidebar();
  }, [onClick, toggleSidebar]);

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn(
        "h-7 w-7 rounded-full bg-background border", 
        "hover:bg-accent hover:text-accent-foreground transition-all duration-150",
        "hover:scale-105 focus:scale-105",
        "absolute right-2 top-1/2 -translate-y-1/2 z-[100] shadow-sm", 
        "will-change-transform",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {state === "expanded" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      <span className="sr-only">
        {state === "expanded" ? t('sidebar.collapseSidebar') : t('sidebar.expandSidebar')}
      </span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"
