import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import type {
  Agent,
  AttendanceRecord,
  AttendanceSubmission,
  AuditRecord,
  EodReport,
  IntraSubmission,
  PerfHistory,
  QaRecord,
  ShadowLog,
  TransferRecord,
  Snapshot,
  SpiffRecord,
  VaultDoc,
  VaultMeeting,
  WeeklyTarget,
} from '../types'
import type { DataStore } from './store.types'
import { createApiClient } from './apiClient'
import type { StoreCollections } from './apiClient'
import { estDateKey } from '../utils'

type Setter<T> = React.Dispatch<SetStateAction<T>>
const MIN_RELOAD_GAP_MS = 1500
const RATE_LIMIT_BACKOFF_MS = 30_000
const COLLECTION_SYNC_DEBOUNCE_MS = 600
const HOT_COLLECTION_SYNC_DEBOUNCE_MS = 1500
const COLLECTION_SYNC_BASE_RETRY_MS = 1500
const COLLECTION_SYNC_MAX_RETRY_MS = 30_000
const MAX_COLLECTION_RETRY_POWER = 5
const HOT_COLLECTION_KEYS: ReadonlySet<keyof StoreCollections> = new Set(['attendance', 'transfers'])

function resolveNext<T>(next: SetStateAction<T>, current: T): T {
  return typeof next === 'function' ? (next as (value: T) => T)(current) : next
}

export function useDataStore(): DataStore {
  const client = useMemo(() => createApiClient(), [])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedInState] = useState(true)
  const hasLoadedRemoteRef = useRef(false)

  const [agentsState, setAgentsState] = useState<Agent[]>([])
  const [snapshotsState, setSnapshotsState] = useState<Snapshot[]>([])
  const [perfHistoryState, setPerfHistoryState] = useState<PerfHistory[]>([])
  const [qaRecordsState, setQaRecordsState] = useState<QaRecord[]>([])
  const [auditRecordsState, setAuditRecordsState] = useState<AuditRecord[]>([])
  const [attendanceState, setAttendanceState] = useState<AttendanceRecord[]>([])
  const [spiffRecordsState, setSpiffRecordsState] = useState<SpiffRecord[]>([])
  const [attendanceSubmissionsState, setAttendanceSubmissionsState] = useState<AttendanceSubmission[]>([])
  const [intraSubmissionsState, setIntraSubmissionsState] = useState<IntraSubmission[]>([])
  const [weeklyTargetsState, setWeeklyTargetsState] = useState<WeeklyTarget[]>([])
  const [transfersState, setTransfersState] = useState<TransferRecord[]>([])
  const [shadowLogsState, setShadowLogsState] = useState<ShadowLog[]>([])
  const [vaultMeetingsState, setVaultMeetingsState] = useState<VaultMeeting[]>([])
  const [vaultDocsState, setVaultDocsState] = useState<VaultDoc[]>([])
  const [eodReportsState, setEodReportsState] = useState<EodReport[]>([])
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const [lastPoliciesBotRun, setLastPoliciesBotRun] = useState<string | null>(null)
  const [houseMarketing, setHouseMarketing] = useState<{ dateKey: string; amount: number } | null>(null)
  const shadowSyncInFlightRef = useRef(false)
  const shadowSyncQueuedRef = useRef(false)
  const shadowSyncLatestRef = useRef<ShadowLog[]>([])
  const reloadInFlightRef = useRef<Promise<void> | null>(null)
  const reloadQueuedRef = useRef(false)
  const lastReloadAttemptAtRef = useRef(0)
  const backoffUntilRef = useRef(0)
  const pendingCollectionSyncRef = useRef<Partial<StoreCollections>>({})
  const collectionSyncTimersRef = useRef<Partial<Record<keyof StoreCollections, ReturnType<typeof setTimeout>>>>({})
  const collectionSyncInFlightRef = useRef<Partial<Record<keyof StoreCollections, boolean>>>({})
  const collectionSyncQueuedRef = useRef<Partial<Record<keyof StoreCollections, boolean>>>({})
  const collectionBackoffUntilRef = useRef<Partial<Record<keyof StoreCollections, number>>>({})
  const collectionRetryCountRef = useRef<Partial<Record<keyof StoreCollections, number>>>({})
  const loadFromApi = useCallback(async () => {
    try {
      const state = await client.getState()
      if (import.meta.env.DEV) {
        const todayKey = estDateKey(new Date())
        console.log(
          '[state] snapshots count',
          state.snapshots?.length,
          'today',
          state.snapshots?.filter((s) => s.dateKey === todayKey).length,
        )
      }
      setAgentsState(state.agents)
      setSnapshotsState(state.snapshots)
      setPerfHistoryState(state.perfHistory)
      setQaRecordsState(state.qaRecords)
      setAuditRecordsState(state.auditRecords)
      setAttendanceState(state.attendance)
      setSpiffRecordsState(state.spiffRecords ?? [])
      setAttendanceSubmissionsState(state.attendanceSubmissions ?? [])
      setIntraSubmissionsState(state.intraSubmissions ?? [])
      setWeeklyTargetsState(state.weeklyTargets)
      setTransfersState(state.transfers ?? [])
      setShadowLogsState(state.shadowLogs ?? [])
      setVaultMeetingsState(state.vaultMeetings)
      setVaultDocsState(state.vaultDocs)
      setEodReportsState(state.eodReports ?? [])
      setLastPoliciesBotRun(state.lastPoliciesBotRun ?? null)
      setHouseMarketing(state.houseMarketing ?? null)
      hasLoadedRemoteRef.current = true
      setError(null)
      setLastFetchedAt(new Date().toISOString())
      backoffUntilRef.current = 0
    } catch (err) {
      hasLoadedRemoteRef.current = false
      const message = err instanceof Error ? err.message : 'Failed to load data.'
      if (/429/.test(message)) {
        backoffUntilRef.current = Date.now() + RATE_LIMIT_BACKOFF_MS
      }
      setError(message)
    }
  }, [client])

  const reloadFromApi = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force === true
    const now = Date.now()
    if (!force) {
      if (now < backoffUntilRef.current) return
      if (now - lastReloadAttemptAtRef.current < MIN_RELOAD_GAP_MS) return
    }
    lastReloadAttemptAtRef.current = now

    if (reloadInFlightRef.current) {
      reloadQueuedRef.current = true
      await reloadInFlightRef.current
      return
    }
    const run = (async () => {
      do {
        reloadQueuedRef.current = false
        await loadFromApi()
      } while (reloadQueuedRef.current)
    })()
    reloadInFlightRef.current = run
    try {
      await run
    } finally {
      reloadInFlightRef.current = null
    }
  }, [loadFromApi])

  const hydratingRef = useRef(true)

  const wrapSetter = useCallback(
    <T,>(setter: Setter<T>): Setter<T> =>
      (next) => {
        setter((current) => resolveNext(next, current))
      },
    [],
  )

  const setLoggedIn = useCallback<Setter<boolean>>((next) => {
    setLoggedInState((current) => resolveNext(next, current))
  }, [])

  const setAgents = wrapSetter(setAgentsState)
  const setSnapshots = wrapSetter(setSnapshotsState)
  const setPerfHistory = wrapSetter(setPerfHistoryState)
  const setQaRecords = wrapSetter(setQaRecordsState)
  const setAuditRecords = wrapSetter(setAuditRecordsState)
  const setAttendance = wrapSetter(setAttendanceState)
  const setSpiffRecords = wrapSetter(setSpiffRecordsState)
  const setAttendanceSubmissions = wrapSetter(setAttendanceSubmissionsState)
  const setIntraSubmissions = wrapSetter(setIntraSubmissionsState)
  const setWeeklyTargets = wrapSetter(setWeeklyTargetsState)
  const setTransfers = wrapSetter(setTransfersState)
  const setShadowLogs = wrapSetter(setShadowLogsState)
  const setVaultMeetings = wrapSetter(setVaultMeetingsState)
  const setVaultDocs = wrapSetter(setVaultDocsState)
  const setEodReports = wrapSetter(setEodReportsState)

  const login = useCallback(async () => {
    hydratingRef.current = true
    try {
      setLoggedInState(true)
      await reloadFromApi({ force: true })
      setError(null)
    } finally {
      hydratingRef.current = false
    }
  }, [reloadFromApi])

  const logout = useCallback(async () => {
    // No-op logout in no-auth mode; keep dashboard accessible
    setLoggedInState(true)
    hasLoadedRemoteRef.current = false
    setError(null)
  }, [])

  const syncCollection = useCallback(
    async <K extends Parameters<typeof client.putCollection>[0]>(key: K, value: Parameters<typeof client.putCollection<K>>[1]) => {
      if (hydratingRef.current || !hasLoadedRemoteRef.current) return
      const normalizeErrorMessage = (err: unknown): string =>
        err instanceof Error ? err.message : 'Failed to sync data.'
      const isRateLimitError = (message: string): boolean => /429|rate[\s-]?limit/i.test(message)
      const getSyncDebounceMs = (collectionKey: keyof StoreCollections): number =>
        HOT_COLLECTION_KEYS.has(collectionKey) ? HOT_COLLECTION_SYNC_DEBOUNCE_MS : COLLECTION_SYNC_DEBOUNCE_MS
      const clearCollectionTimer = (collectionKey: keyof StoreCollections) => {
        const timer = collectionSyncTimersRef.current[collectionKey]
        if (!timer) return
        clearTimeout(timer)
        delete collectionSyncTimersRef.current[collectionKey]
      }
      const scheduleCollectionFlush = (collectionKey: keyof StoreCollections, delayMs: number) => {
        clearCollectionTimer(collectionKey)
        collectionSyncTimersRef.current[collectionKey] = setTimeout(() => {
          delete collectionSyncTimersRef.current[collectionKey]
          void flushCollectionSync(collectionKey)
        }, Math.max(delayMs, 0))
      }

      const flushCollectionSync = async (collectionKey: keyof StoreCollections) => {
        if (hydratingRef.current || !hasLoadedRemoteRef.current) return
        const now = Date.now()
        const backoffUntil = collectionBackoffUntilRef.current[collectionKey] ?? 0
        if (now < backoffUntil) {
          scheduleCollectionFlush(collectionKey, backoffUntil - now)
          return
        }
        if (collectionSyncInFlightRef.current[collectionKey]) {
          collectionSyncQueuedRef.current[collectionKey] = true
          return
        }

        collectionSyncInFlightRef.current[collectionKey] = true
        try {
          do {
            collectionSyncQueuedRef.current[collectionKey] = false
            const payload = pendingCollectionSyncRef.current[collectionKey] as StoreCollections[typeof collectionKey] | undefined
            if (payload === undefined) break
            delete pendingCollectionSyncRef.current[collectionKey]
            try {
              await client.putCollection(collectionKey, payload)
              collectionRetryCountRef.current[collectionKey] = 0
              collectionBackoffUntilRef.current[collectionKey] = 0
              setError((current) => (current && /429|rate[\s-]?limit/i.test(current) ? null : current))
            } catch (err) {
              const message = normalizeErrorMessage(err)
              pendingCollectionSyncRef.current[collectionKey] = payload
              if (isRateLimitError(message)) {
                const retryCount = Math.min((collectionRetryCountRef.current[collectionKey] ?? 0) + 1, MAX_COLLECTION_RETRY_POWER)
                collectionRetryCountRef.current[collectionKey] = retryCount
                const exponential = 2 ** (retryCount - 1)
                const jitter = Math.floor(Math.random() * 500)
                const retryMs = Math.min(COLLECTION_SYNC_BASE_RETRY_MS * exponential + jitter, COLLECTION_SYNC_MAX_RETRY_MS)
                collectionBackoffUntilRef.current[collectionKey] = Date.now() + retryMs
                scheduleCollectionFlush(collectionKey, retryMs)
              }
              setError(message)
              break
            }
          } while (collectionSyncQueuedRef.current[collectionKey])
        } finally {
          collectionSyncInFlightRef.current[collectionKey] = false
        }
      }

      pendingCollectionSyncRef.current[key] = value
      scheduleCollectionFlush(key, getSyncDebounceMs(key))
    },
    [client],
  )

  const pushSnapshotsToApi = useCallback(
    async (snapshots: Snapshot[]) => {
      if (!hasLoadedRemoteRef.current) return
      try {
        await client.putCollection('snapshots', snapshots)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sync data.')
      }
    },
    [client],
  )

  const flushShadowLogsSync = useCallback(async () => {
    if (hydratingRef.current || !hasLoadedRemoteRef.current) return
    shadowSyncLatestRef.current = shadowLogsState
    if (shadowSyncInFlightRef.current) {
      shadowSyncQueuedRef.current = true
      return
    }

    shadowSyncInFlightRef.current = true
    try {
      do {
        shadowSyncQueuedRef.current = false
        try {
          await client.putCollection('shadowLogs', shadowSyncLatestRef.current)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to sync data.')
        }
      } while (shadowSyncQueuedRef.current)
    } finally {
      shadowSyncInFlightRef.current = false
    }
  }, [client, shadowLogsState])

  useEffect(() => {
    const load = async () => {
      try {
        await reloadFromApi({ force: true })
      } finally {
        hydratingRef.current = false
        setIsLoading(false)
      }
    }
    void load()
  }, [reloadFromApi])

  useEffect(() => {
    void syncCollection('agents', agentsState)
  }, [agentsState, syncCollection])
  // Snapshots are written only by the bot; dashboard only reads. Do not sync snapshots
  // back to the API or we can overwrite fresh bot data with stale state after a cached GET.
  // perfHistory is written by the EOD bot (eod.py); do not sync
  // from the dashboard or we overwrite corrected EOD totals with stale client state.
  // useEffect(() => {
  //   void syncCollection('perfHistory', perfHistoryState)
  // }, [perfHistoryState, syncCollection])
  useEffect(() => {
    void syncCollection('qaRecords', qaRecordsState)
  }, [qaRecordsState, syncCollection])
  useEffect(() => {
    void syncCollection('auditRecords', auditRecordsState)
  }, [auditRecordsState, syncCollection])
  useEffect(() => {
    void syncCollection('attendance', attendanceState)
  }, [attendanceState, syncCollection])
  useEffect(() => {
    void syncCollection('spiffRecords', spiffRecordsState)
  }, [spiffRecordsState, syncCollection])
  useEffect(() => {
    void syncCollection('attendanceSubmissions', attendanceSubmissionsState)
  }, [attendanceSubmissionsState, syncCollection])
  useEffect(() => {
    void syncCollection('intraSubmissions', intraSubmissionsState)
  }, [intraSubmissionsState, syncCollection])
  useEffect(() => {
    void syncCollection('weeklyTargets', weeklyTargetsState)
  }, [weeklyTargetsState, syncCollection])
  useEffect(() => {
    void syncCollection('vaultMeetings', vaultMeetingsState)
  }, [vaultMeetingsState, syncCollection])
  useEffect(() => {
    void syncCollection('vaultDocs', vaultDocsState)
  }, [vaultDocsState, syncCollection])
  useEffect(() => {
    void syncCollection('eodReports', eodReportsState)
  }, [eodReportsState, syncCollection])
  useEffect(() => {
    void syncCollection('transfers', transfersState)
  }, [transfersState, syncCollection])
  useEffect(() => {
    void flushShadowLogsSync()
  }, [flushShadowLogsSync])
  useEffect(
    () => () => {
      for (const key of Object.keys(collectionSyncTimersRef.current) as Array<keyof StoreCollections>) {
        const timer = collectionSyncTimersRef.current[key]
        if (timer) clearTimeout(timer)
      }
    },
    [],
  )

  return {
    loggedIn,
    setLoggedIn,
    login,
    logout,
    reload: async () => {
      setIsLoading(true)
      hydratingRef.current = true
      try {
        await reloadFromApi({ force: true })
      } finally {
        hydratingRef.current = false
        setIsLoading(false)
      }
    },
    lastFetchedAt,
    isLoading,
    error,
    clearError: () => setError(null),
    agents: agentsState,
    setAgents,
    snapshots: snapshotsState,
    setSnapshots,
    pushSnapshotsToApi,
    perfHistory: perfHistoryState,
    setPerfHistory,
    qaRecords: qaRecordsState,
    setQaRecords,
    auditRecords: auditRecordsState,
    setAuditRecords,
    attendance: attendanceState,
    setAttendance,
    transfers: transfersState,
    setTransfers,
    shadowLogs: shadowLogsState,
    setShadowLogs,
    flushShadowLogsSync,
    spiffRecords: spiffRecordsState,
    setSpiffRecords,
    attendanceSubmissions: attendanceSubmissionsState,
    setAttendanceSubmissions,
    intraSubmissions: intraSubmissionsState,
    setIntraSubmissions,
    weeklyTargets: weeklyTargetsState,
    setWeeklyTargets,
    vaultMeetings: vaultMeetingsState,
    setVaultMeetings,
    vaultDocs: vaultDocsState,
    setVaultDocs,
    eodReports: eodReportsState,
    setEodReports,
    lastPoliciesBotRun,
    houseMarketing,
  }
}
