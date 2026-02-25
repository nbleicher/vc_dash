export const SLOT_CONFIG = [
  { key: '11:00', label: '11:00 AM', minuteOfDay: 11 * 60 },
  { key: '13:00', label: '1:00 PM', minuteOfDay: 13 * 60 },
  { key: '15:00', label: '3:00 PM', minuteOfDay: 15 * 60 },
  { key: '17:00', label: '5:00 PM', minuteOfDay: 17 * 60 },
] as const

export const CARRIERS = ['Aetna', 'UHC', 'Humana'] as const
export const POLICY_STATUSES = [
  'pending_cms',
  'flagged',
  'pending_aor',
  'pending_app_request',
  'unknown',
  'accepted',
  'issued',
  'placed',
  'cancelled',
  'old_policy_terminated',
  'withdrawn',
  'future_cancellation',
  'rejected',
  'wrong_sep',
] as const
export const ZONE = 'America/New_York'
