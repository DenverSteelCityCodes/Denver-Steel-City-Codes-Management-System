// Unfinished registration wizard answers, kept on this device so a reload, the back button or an
// expired sign-in doesn't lose them (spec 16). Typed signatures are never stored. Drafts are
// per account + camper and are cleared on submit and on sign-out.
const PREFIX = 'scc-draft:'
const NEVER_STORED = ['waiver_signature', 'guardian_signature']

export interface RegistrationDraft {
  form: Record<string, unknown>
  step: number
  name: string          // camper name for the dashboard card ("Finish registering Maya")
  savedAt: string
}

export function draftKey(userId: string, studentId: string | null): string {
  return `${PREFIX}${userId}:${studentId ?? 'new'}`
}

export function readDraft(key: string): RegistrationDraft | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as RegistrationDraft) : null
  } catch { return null }
}

export function writeDraft(key: string, form: Record<string, unknown>, step: number) {
  const kept = Object.fromEntries(Object.entries(form).filter(([k]) => !NEVER_STORED.includes(k)))
  const name = `${String(form.first_name ?? '')} ${String(form.last_name ?? '')}`.trim()
  try {
    localStorage.setItem(key, JSON.stringify({ form: kept, step, name, savedAt: new Date().toISOString() } satisfies RegistrationDraft))
  } catch { /* private mode / storage full: the wizard still works, just without a draft */ }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// Every draft this account has on this device, newest first.
export function listDrafts(userId: string): { key: string; studentId: string | null; draft: RegistrationDraft }[] {
  const out: { key: string; studentId: string | null; draft: RegistrationDraft }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(`${PREFIX}${userId}:`)) continue
      const draft = readDraft(key)
      if (!draft) continue
      const id = key.slice(`${PREFIX}${userId}:`.length)
      out.push({ key, studentId: id === 'new' ? null : id, draft })
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => b.draft.savedAt.localeCompare(a.draft.savedAt))
}

// On sign-out: drafts can hold a child's health details, so they don't outlive the session.
export function clearAllDrafts() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
