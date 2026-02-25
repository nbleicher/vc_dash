import type { StoreState } from '../types.js'

export type EntityKey = Exclude<keyof StoreState, 'lastPoliciesBotRun' | 'houseMarketing'>

export interface StoreAdapter {
  getState(): Promise<StoreState>
  getCollection<T extends EntityKey>(key: T): Promise<StoreState[T]>
  replaceCollection<T extends EntityKey>(key: T, rows: StoreState[T]): Promise<StoreState[T]>
  getLastPoliciesBotRun(): Promise<string | null>
  setLastPoliciesBotRun(iso: string): Promise<void>
  getHouseMarketing(): Promise<StoreState['houseMarketing']>
  setHouseMarketing(dateKey: string, amount: number): Promise<void>
  close(): Promise<void> | void
}
