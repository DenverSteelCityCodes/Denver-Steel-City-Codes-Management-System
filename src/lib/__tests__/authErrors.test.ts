import { describe, expect, it } from 'vitest'
import { GENERIC_ERROR, authErrorMessage, classifyAuthError, emailProblem, isExistingAccount } from '../authErrors'

describe('auth errors › never show raw server text', () => {
  it('maps the errors the signed-out pages meet to plain sentences', () => {
    expect(classifyAuthError({ message: 'Invalid login credentials', code: 'invalid_credentials' })).toBe('wrong-credentials')
    expect(classifyAuthError({ message: 'Email not confirmed' })).toBe('email-not-confirmed')
    expect(classifyAuthError({ message: 'User already registered' })).toBe('existing-account')
    expect(classifyAuthError({ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit' })).toBe('rate-limit')
    expect(classifyAuthError({ message: 'New password should be different from the old password.', code: 'same_password' })).toBe('same-password')
    expect(classifyAuthError({ message: 'Password is known to be weak and easy to guess', code: 'weak_password' })).toBe('breached-password')
    expect(classifyAuthError({ message: 'Password should be at least 8 characters.', code: 'weak_password' })).toBe('weak-password')
    expect(classifyAuthError({ message: 'Invalid TOTP code entered', code: 'mfa_verification_failed' })).toBe('bad-code')
    expect(classifyAuthError({ message: 'Failed to fetch', name: 'AuthRetryableFetchError', status: 0 })).toBe('network')
  })

  it('falls back to the generic line, with the camp address, for anything else', () => {
    const msg = authErrorMessage({ message: 'Database error saving new user' })
    expect(msg).toBe(GENERIC_ERROR)
    expect(msg).toContain('denver@steelcitycodes.org')
    expect(msg).not.toContain('Database')
  })

  it('names the recovery, never a direction on the page', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe('Wrong email or password. Try again, or use Forgot password to set a new one.')
  })
})

describe('signup › an email that already has an account', () => {
  it('is caught when confirmations are on (a user with no identities, no email sent)', () => {
    expect(isExistingAccount({ identities: [] }, null)).toBe(true)
  })
  it('is caught when confirmations are off (an error)', () => {
    expect(isExistingAccount(null, { message: 'User already registered' })).toBe(true)
  })
  it('is not raised for a real new account or another error', () => {
    expect(isExistingAccount({ identities: [{}] }, null)).toBe(false)
    expect(isExistingAccount(null, { message: 'Failed to fetch' })).toBe(false)
  })
})

describe('emailProblem', () => {
  it('accepts an ordinary address', () => {
    expect(emailProblem(' riya.shah@example.com ')).toBeNull()
  })
  it('says what is wrong', () => {
    expect(emailProblem('')).toBe('Enter your email.')
    expect(emailProblem('riya shah@example.com')).toMatch(/spaces/)
    expect(emailProblem('riya.shah')).toMatch(/whole email/)
    expect(emailProblem('riya.shah@example')).toMatch(/ending, like \.com/)
  })
})
