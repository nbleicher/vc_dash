import { useCallback } from 'react'
import type { DataStore } from '../data'
import type { Snapshot, VaultMeeting } from '../types'
import { estDateKey, uid } from '../utils'

type VaultActionsData = {
  selectedVaultAgent: { id: string } | null
  snapshots: Snapshot[]
}

type MeetingFormState = {
  dateKey: string
  meetingType: VaultMeeting['meetingType']
  notes: string
  actionItems: string
}

export function useVaultActions(
  store: DataStore,
  data: VaultActionsData,
  meetingForm: MeetingFormState,
  setMeetingForm: React.Dispatch<React.SetStateAction<MeetingFormState>>,
  setUiError: (msg: string | null) => void,
) {
  const { selectedVaultAgent } = data

  const addMeeting = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault()
      if (!selectedVaultAgent) return
      store.setVaultMeetings((prev) => [
        ...prev,
        {
          id: uid('meet'),
          agentId: selectedVaultAgent.id,
          dateKey: meetingForm.dateKey,
          meetingType: meetingForm.meetingType,
          notes: meetingForm.notes.trim(),
          actionItems: meetingForm.actionItems.trim(),
        },
      ])
      setMeetingForm({ dateKey: estDateKey(new Date()), meetingType: 'Coaching', notes: '', actionItems: '' })
    },
    [store, selectedVaultAgent, meetingForm, setMeetingForm],
  )

  const handlePdfUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      if (!selectedVaultAgent) return
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setUiError('PDF only uploads are allowed.')
        e.target.value = ''
        return
      }
      store.setVaultDocs((prev) => [
        ...prev,
        {
          id: uid('doc'),
          agentId: selectedVaultAgent.id,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        },
      ])
      e.target.value = ''
    },
    [store, selectedVaultAgent, setUiError],
  )

  const handleMeetingUpdate = useCallback(
    (
      meetingId: string,
      patch: Pick<VaultMeeting, 'dateKey' | 'meetingType' | 'notes' | 'actionItems'>,
    ): void => {
      store.setVaultMeetings((prev) =>
        prev.map((m) => (m.id === meetingId ? { ...m, ...patch } : m)),
      )
    },
    [store],
  )

  const handleSnapshotUpdate = useCallback(
    (id: string, patch: Pick<Snapshot, 'billableCalls' | 'sales'>): void => {
      store.setSnapshots((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                billableCalls: patch.billableCalls,
                sales: patch.sales,
                updatedAt: new Date().toISOString(),
              }
            : row,
        ),
      )
    },
    [store],
  )

  return {
    addMeeting,
    handlePdfUpload,
    handleMeetingUpdate,
    handleSnapshotUpdate,
  }
}
