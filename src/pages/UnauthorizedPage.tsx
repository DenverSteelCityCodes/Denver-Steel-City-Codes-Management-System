import { Link } from 'react-router-dom'
import { BrandBar } from '../components/Wordmark'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <BrandBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="w-14 h-14 rounded-full bg-danger-soft flex items-center justify-center mb-4">
        <span className="text-danger text-2xl">✕</span>
      </div>
      <h1 className="font-sans font-bold text-2xl text-ink mb-2">Access denied</h1>
      <p className="font-sans text-ink-muted text-sm mb-6 max-w-xs">
        You don't have permission to view this page.
      </p>
      <Link
        to="/login"
        className="font-sans font-semibold text-sm text-ink hover:underline"
      >
        Back to sign in
      </Link>
      </main>
    </div>
  )
}
