import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PublicShell, { PageHead } from '../components/PublicShell'
import { FormError, Spinner } from '../components/PublicForm'
import Button from '../components/Button'
import { GENERIC_ERROR } from '../lib/authErrors'
import { focusOnMount } from '../lib/focus'
import { buttonClass } from '../lib/ui'

// The two links in the notify-me emails (spec 30): /camp/confirm?t=… and /camp/unsubscribe?t=….
// Each waits for a press instead of acting on page load, so a mail scanner that opens links can't
// confirm a stranger's address or unsubscribe anyone. The token is checked by the database.
type Kind = 'confirm' | 'unsubscribe'

const COPY: Record<Kind, { title: string; lede: string; button: string; busy: string; doneTitle: string; done: (year: number) => string }> = {
  confirm: {
    title: 'Confirm your email',
    lede: 'Press the button to get camp registration emails at this address: one with the opening time, and one when registration opens.',
    button: 'Yes, email me',
    busy: 'Confirming…',
    doneTitle: "You're on the list",
    done: year => `We'll email you the ${year} opening time, and again when registration opens. Every email has an unsubscribe link.`,
  },
  unsubscribe: {
    title: 'Stop registration emails?',
    lede: "You won't get any more camp registration emails at this address.",
    button: 'Unsubscribe',
    busy: 'Unsubscribing…',
    doneTitle: "You're unsubscribed",
    done: year => `You won't get more ${year} registration emails from us. Changed your mind? Sign up again on the camp page.`,
  },
}

export default function CampListLinkPage({ kind }: { kind: Kind }) {
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const copy = COPY[kind]
  const [busy, setBusy] = useState(false)
  const [year, setYear] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(token ? null : 'This link is missing its code. Open it again from the email, or copy the whole link.')

  async function go() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc(kind === 'confirm' ? 'confirm_interest' : 'leave_interest_list', { p_token: token })
    setBusy(false)
    // The database's sentence for a bad link names the fix; anything else is the generic line.
    if (error) setError(error.code === 'P0001' ? error.message : GENERIC_ERROR)
    else setYear(Number(data))
  }

  if (year !== null) {
    return (
      <PublicShell>
        <PageHead title={copy.doneTitle} lede={copy.done(year)} headingRef={focusOnMount} />
        <Link to="/camp" className={buttonClass('ink')}>See the camp page</Link>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <PageHead title={copy.title} lede={copy.lede} />
      <div className="grid gap-4 justify-items-start">
        {token && (
          <Button variant="primary" onClick={() => { void go() }} disabled={busy} className="max-[479px]:w-full">
            {busy ? <><Spinner />{copy.busy}</> : copy.button}
          </Button>
        )}
        {error && <FormError actions={<Link to="/camp" className={buttonClass('text')}>Go to the camp page</Link>}>{error}</FormError>}
      </div>
    </PublicShell>
  )
}
