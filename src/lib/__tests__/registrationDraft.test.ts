import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllDrafts, draftKey, listDrafts, readDraft, writeDraft } from '../registrationDraft'

// A minimal in-memory localStorage for the node test environment.
class MemoryStorage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

beforeEach(() => { (globalThis as { localStorage: unknown }).localStorage = new MemoryStorage() })

describe('registration drafts', () => {
  it('never stores typed signatures', () => {
    const key = draftKey('u1', null)
    writeDraft(key, { first_name: 'Maya', last_name: 'Brooks', waiver_signature: 'Maya Brooks', guardian_signature: 'Taylor Brooks' }, 3)
    const d = readDraft(key)!
    expect(d.form).toEqual({ first_name: 'Maya', last_name: 'Brooks' })
    expect(d.step).toBe(3)
    expect(d.name).toBe('Maya Brooks')
  })

  it('lists only this account\'s drafts, and clears them all on sign-out', () => {
    writeDraft(draftKey('u1', null), { first_name: 'A' }, 1)
    writeDraft(draftKey('u1', 's9'), { first_name: 'B' }, 2)
    writeDraft(draftKey('u2', null), { first_name: 'C' }, 1)
    localStorage.setItem('unrelated', 'x')
    const mine = listDrafts('u1')
    expect(mine.map(d => d.studentId).sort()).toEqual(['s9', null].sort())
    clearAllDrafts()
    expect(listDrafts('u1')).toEqual([])
    expect(listDrafts('u2')).toEqual([])
    expect(localStorage.getItem('unrelated')).toBe('x')
  })
})
