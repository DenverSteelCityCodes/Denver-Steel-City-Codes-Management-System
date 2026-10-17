// "Also email": open the mail client with recipients in BCC, or copy the addresses when the list
// is too long for a URL. No server-side sending — the user's own mail client does the work.

// Most mail clients and browsers truncate mailto: links somewhere above 2,000 characters.
const MAILTO_LIMIT = 1800

export type MailResult = { kind: 'opened' } | { kind: 'copied'; count: number } | { kind: 'none' }

export function buildMailto(emails: string[], subject: string, body: string): string {
  const q = new URLSearchParams()
  if (emails.length) q.set('bcc', emails.join(','))
  if (subject) q.set('subject', subject)
  if (body) q.set('body', body)
  // URLSearchParams encodes spaces as '+', which mail clients show literally; use %20.
  return `mailto:?${q.toString().replace(/\+/g, '%20')}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Opens the mail client when the link fits; otherwise copies the addresses for pasting into BCC.
export async function openMailOrCopy(emails: string[], subject: string, body: string): Promise<MailResult> {
  if (emails.length === 0) return { kind: 'none' }
  const href = buildMailto(emails, subject, body)
  if (href.length <= MAILTO_LIMIT) {
    window.location.href = href
    return { kind: 'opened' }
  }
  const ok = await copyText(emails.join(', '))
  if (!ok) {
    // Clipboard blocked: fall back to a recipient-less draft so the user still gets the text.
    window.location.href = buildMailto([], subject, body)
    return { kind: 'opened' }
  }
  return { kind: 'copied', count: emails.length }
}
