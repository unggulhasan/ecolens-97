"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { listAllFiles } from "@/lib/api"
import {
  applyTagUpdates,
  formatFileResults,
  type FileResult,
  type PaginationMeta,
  type TagUpdate,
} from "@/lib/file-results"

export type HomeTab = "all" | "mine"

type TabState = {
  results: FileResult[] | null
  pagination: PaginationMeta | null
  page: number
  error: string | null
  initialized: boolean
}

type HomeFilesContextValue = {
  activeTab: HomeTab
  setActiveTab: (tab: HomeTab) => void
  tabStates: Record<HomeTab, TabState>
  loading: boolean
  changePage: (page: number) => Promise<void>
  refreshAfterDelete: (deletedCount: number) => Promise<void>
  applyTagUpdates: (updates: TagUpdate[]) => void
}

const INITIAL_TAB_STATE: TabState = {
  results: null,
  pagination: null,
  page: 1,
  error: null,
  initialized: false,
}

const HomeFilesContext = React.createContext<HomeFilesContextValue | null>(null)

export function useHomeFiles() {
  const context = React.useContext(HomeFilesContext)
  if (!context) {
    throw new Error("useHomeFiles must be used within HomeFilesProvider")
  }
  return context
}

export function HomeFilesProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = React.useState<HomeTab>("all")
  const [loading, setLoading] = React.useState(false)
  const [tabStates, setTabStates] = React.useState<Record<HomeTab, TabState>>({
    all: { ...INITIAL_TAB_STATE },
    mine: { ...INITIAL_TAB_STATE },
  })

  const tabStatesRef = React.useRef(tabStates)
  tabStatesRef.current = tabStates

  const hasEnteredHomeRef = React.useRef(false)
  const fetchGenerationRef = React.useRef(0)

  const fetchTab = React.useCallback(
    async (tab: HomeTab, page: number, force = false) => {
      const idToken = (session as { idToken?: string })?.idToken
      if (!idToken) return

      const current = tabStatesRef.current[tab]
      if (!force && current.initialized && current.page === page) {
        return
      }

      const generation = ++fetchGenerationRef.current
      setLoading(true)

      try {
        const data = await listAllFiles(idToken, page, { mine: tab === "mine" })
        if (generation !== fetchGenerationRef.current) return

        const userEmail = session?.user?.email || ""
        setTabStates((prev) => ({
          ...prev,
          [tab]: {
            results: formatFileResults(data.results, userEmail),
            pagination: {
              page: data.page,
              pageSize: data.page_size,
              total: data.total,
            },
            page: data.page,
            error: null,
            initialized: true,
          },
        }))
      } catch (err: unknown) {
        if (generation !== fetchGenerationRef.current) return

        const message =
          err instanceof Error ? err.message : "Failed to load files."
        setTabStates((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            results: [],
            pagination: null,
            page,
            error: message,
            initialized: true,
          },
        }))
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false)
        }
      }
    },
    [session]
  )

  const changePage = React.useCallback(
    async (page: number) => {
      await fetchTab(activeTab, page, true)
    },
    [activeTab, fetchTab]
  )

  const refreshAfterDelete = React.useCallback(
    async (deletedCount: number) => {
      const current = tabStatesRef.current[activeTab]
      if (!current.pagination) return

      const newTotal = Math.max(0, current.pagination.total - deletedCount)
      const totalPages = Math.max(
        1,
        Math.ceil(newTotal / current.pagination.pageSize)
      )
      const targetPage = Math.min(current.page, totalPages)
      await fetchTab(activeTab, targetPage, true)
    },
    [activeTab, fetchTab]
  )

  const applyTagUpdatesToCache = React.useCallback((updates: TagUpdate[]) => {
    if (updates.length === 0) return

    setTabStates((prev) => ({
      all: {
        ...prev.all,
        results: applyTagUpdates(prev.all.results, updates),
      },
      mine: {
        ...prev.mine,
        results: applyTagUpdates(prev.mine.results, updates),
      },
    }))
  }, [])

  const handleSetActiveTab = React.useCallback(
    (tab: HomeTab) => {
      setActiveTab(tab)
      if (pathname === "/home") {
        void fetchTab(tab, tabStatesRef.current[tab].page)
      }
    },
    [pathname, fetchTab]
  )

  React.useEffect(() => {
    if (pathname !== "/home") return
    if (hasEnteredHomeRef.current) return

    const idToken = (session as { idToken?: string })?.idToken
    if (!idToken) return

    hasEnteredHomeRef.current = true
    void fetchTab(activeTab, tabStatesRef.current[activeTab].page)
  }, [pathname, session, activeTab, fetchTab])

  const value = React.useMemo(
    () => ({
      activeTab,
      setActiveTab: handleSetActiveTab,
      tabStates,
      loading,
      changePage,
      refreshAfterDelete,
      applyTagUpdates: applyTagUpdatesToCache,
    }),
    [
      activeTab,
      handleSetActiveTab,
      tabStates,
      loading,
      changePage,
      refreshAfterDelete,
      applyTagUpdatesToCache,
    ]
  )

  return (
    <HomeFilesContext.Provider value={value}>
      {children}
    </HomeFilesContext.Provider>
  )
}
