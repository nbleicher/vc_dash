import type { StoreState } from '../types.js'

export type EntityKey = keyof StoreState

export interface StoreAdapter {
  getState(): Promise<StoreState>
  getCollection<T extends EntityKey>(key: T): Promise<StoreState[T]>
  replaceCollection<T extends EntityKey>(key: T, rows: StoreState[T]): Promise<StoreState[T]>
  close(): Promise<void> | void
}
