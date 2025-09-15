
/**
 * @file Sidebar context provider
 * 
 * This file contains the React context for the sidebar state management.
 * It provides:
 * - State tracking for sidebar expanded/collapsed state
 * - Mobile detection and responsive behavior
 * - Keyboard shortcut support (Ctrl/Cmd + B)
 * - Cookie persistence for sidebar preferences
 * - Route-based default state behavior
 */

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { usePathname } from "next/navigation"

const SIDEBAR_COOKIE_NAME = "sidebar:state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7  // 7 days
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

/**
 * Context providing sidebar state and methods to control it
 */
export type SidebarContext = {
  state: "expanded" | "collapsed"  // Current visual state of the sidebar
  open: boolean                    // Whether sidebar is open (expanded) or closed (collapsed)
  setOpen: (open: boolean) => void // Function to set the sidebar open state
  openMobile: boolean              // Whether the mobile sidebar is open
  setOpenMobile: (open: boolean) => void // Function to control mobile sidebar
  isMobile: boolean                // Whether the current view is mobile
  toggleSidebar: () => void        // Helper to toggle sidebar state
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

/**
 * Hook to access the sidebar context
 * @returns The sidebar context 
 * @throws Error if used outside of a SidebarProvider
 */
export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

/**
 * Determines the default open state of the sidebar based on stored preference
 * 
 * Reads from cookie to maintain state across page navigations
 */
const getDefaultOpenState = (): boolean => {
  // Check if we&apos;re in the browser environment
  if (typeof window === 'undefined') return false;
  
  // Try to read from cookie
  const cookies = document.cookie.split(';');
  const sidebarCookie = cookies.find(cookie => 
    cookie.trim().startsWith(`${SIDEBAR_COOKIE_NAME}=`)
  );
  
  if (sidebarCookie) {
    const value = sidebarCookie.split('=')[1];
    return value === 'true';
  }
  
  // Default to closed if no cookie found
  return false;
}

interface SidebarProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean           // Default state of the sidebar (open/closed)
  open?: boolean                  // Controlled open state
  onOpenChange?: (open: boolean) => void // Callback for open state changes
  className?: string
  style?: React.CSSProperties
}

/**
 * Provider component for sidebar state and functionality
 */
export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  SidebarProviderProps & React.ComponentProps<"div">
>(
  (
    {
      defaultOpen,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const pathname = usePathname()
    const [openMobile, setOpenMobile] = React.useState(false)

    // Get the default open state based on stored preference
    const routeBasedDefaultOpen = React.useMemo(() => {
      return defaultOpen !== undefined ? defaultOpen : getDefaultOpenState()
    }, [defaultOpen])

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(routeBasedDefaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }

        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
      },
      [setOpenProp, open]
    )

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobile])

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    // Remove the route-based reset effect since we want to preserve state
    // The sidebar state should only change when user manually toggles it

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <div
          style={
            {
              "--sidebar-width": "16rem",
              "--sidebar-width-icon": "3rem",
              ...style,
            } as React.CSSProperties
          }
          className={className}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"
