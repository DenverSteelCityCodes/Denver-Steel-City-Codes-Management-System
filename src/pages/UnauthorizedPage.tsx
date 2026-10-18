import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SignBand from '../components/SignBand'
import PublicShell, { AsideLine, PageHead } from '../components/PublicShell'
import { buttonClass } from '../lib/ui'
import type { UserRole } from '../types/database'

// Almost always a parent (or volunteer) tapping an old link meant for another kind of account.
// Calm, not alarming: say which account this is and send them home (the role router picks it).
const HOME: Record<UserRole, { article: string; sub: string }> = {
  parent: { article: 'a parent', sub: 'Your campers, their classes and updates from camp.' },
  volunteer: { article: 'a volunteer', sub: 'Your application, or your classes, duties and updates.' },
  admin: { article: 'an admin', sub: 'The camp: registration, campers, classes and volunteers.' },
}

export default function UnauthorizedPage() {
  const { role, profile, session, signOut } = useAuth()
  const home = role ? HOME[role] : null
  const who = [profile?.display_name, session?.user.email].filter(Boolean).join(' · ')

  return (
    <PublicShell>
      <PageHead
        title="This page isn't part of your account"
        lede={home
          ? `You're signed in with ${home.article} account. This page belongs to a different kind of account.`
          : 'It belongs to a different kind of account.'}
      />
      {session ? (
        <>
          <SignBand
            to="/"
            label={`Go to my home page.${home ? ` ${home.sub}` : ''}`}
            context={who || 'Signed in'}
            message="Go to my home page"
            sub={home?.sub}
          />
          <div className="mt-4">
            <AsideLine>
              Not your account?{' '}
              <button type="button" onClick={() => { void signOut() }} className={buttonClass('text')}>Sign out</button>
            </AsideLine>
          </div>
        </>
      ) : (
        <Link to="/login" className={buttonClass('primary', undefined, true)}>Sign in</Link>
      )}
    </PublicShell>
  )
}
