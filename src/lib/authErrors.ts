// Plain sentences for the auth errors the signed-out pages can meet (A-public §6.5). Raw server
// text never reaches the screen: every failure maps to a sentence that names the recovery, and
// anything unrecognised gets the generic line with the camp's address.

export const CONTACT_EMAIL = 'denver@steelcitycodes.org'

export const GENERIC_ERROR = `That didn't work. Check your connection and try again. If it keeps happening, email ${CONTACT_EMAIL}.`

export type AuthFailure =
  | 'existing-account'
  | 'wrong-credentials'
  | 'email-not-confirmed'
  | 'rate-limit'
  | 'weak-password'
  | 'breached-password'
  | 'same-password'
  | 'bad-code'
  | 'network'
  | 'unknown'

interface AuthErrorLike { message?: string; code?: string; status?: number; name?: string }

// supabase-js gives a `code` on newer servers and only a message on older ones, so check both.
export function classifyAuthError(error: AuthErrorLike | null | undefined): AuthFailure {
  if (!error) return 'unknown'
  const code = error.code ?? ''
  const msg = error.message ?? ''
  if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|already exists/i.test(msg)) return 'existing-account'
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'wrong-credentials'
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'email-not-confirmed'
  if (code.startsWith('over_') || error.status === 429 || /rate limit|too many/i.test(msg)) return 'rate-limit'
  if (code === 'same_password' || /different from the old|same password|should be different/i.test(msg)) return 'same-password'
  if (/pwned|leaked|breach|known to be/i.test(msg)) return 'breached-password'
  if (code === 'weak_password' || /weak|password should/i.test(msg)) return 'weak-password'
  if (code.startsWith('mfa_') || /invalid totp|code.*(invalid|expired)|(invalid|expired).*code/i.test(msg)) return 'bad-code'
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || /failed to fetch|network|load failed/i.test(msg)) return 'network'
  return 'unknown'
}

const MESSAGES: Record<AuthFailure, string> = {
  'existing-account': "There's already an account with this email.",
  'wrong-credentials': 'Wrong email or password. Try again, or use Forgot password to set a new one.',
  'email-not-confirmed': 'Confirm your email first: open the link we sent when you signed up, then sign in here.',
  'rate-limit': 'Too many tries in a row. Wait a minute, then try again.',
  'weak-password': 'That password is too easy to guess. Try a longer one, like three unrelated words.',
  'breached-password': 'That password has appeared in a data breach. Choose a different one.',
  'same-password': 'Choose a password different from your old one.',
  'bad-code': "That code didn't work. Codes change every 30 seconds: try the one on screen now.",
  network: "We couldn't reach the camp's server. Check your connection and try again.",
  unknown: GENERIC_ERROR,
}

export function authMessage(kind: AuthFailure): string {
  return MESSAGES[kind]
}

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  return MESSAGES[classifyAuthError(error)]
}

// With email confirmations on, signing up with an email that already has an account "succeeds"
// but returns a user with no identities, and no email is sent. With confirmations off, it errors.
export function isExistingAccount(
  user: { identities?: unknown[] | null } | null | undefined,
  error: AuthErrorLike | null | undefined,
): boolean {
  if (error) return classifyAuthError(error) === 'existing-account'
  return Array.isArray(user?.identities) && user.identities.length === 0
}

// One email check for every signed-out form. Says what's wrong, not just "invalid".
export function emailProblem(raw: string): string | null {
  const email = raw.trim()
  if (!email) return 'Enter your email.'
  if (/\s/.test(email)) return 'Take the spaces out of your email.'
  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@')) return 'Enter your whole email, like name@example.com.'
  const domain = email.slice(at + 1)
  if (!domain) return "This email is missing the part after the @, like gmail.com."
  if (!/\.[^.]{2,}$/.test(domain)) return 'This email is missing its ending, like .com. Check it and try again.'
  return null
}
