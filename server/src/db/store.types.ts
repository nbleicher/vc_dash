import type { StoreState } from '../types.js'

export type EntityKey = Exclude<keyof StoreState, 'lastPoliciesBotRun'>

export interface StoreAdapter {
  getState(): Promise<StoreState>
  getCollection<T extends EntityKey>(key: T): Promise<StoreState[T]>
  replaceCollection<T extends EntityKey>(key: T, rows: StoreState[T]): Promise<StoreState[T]>
  setLastPoliciesBotRun(iso: string): Promise<void>
  close(): Promise<void> | void
}
