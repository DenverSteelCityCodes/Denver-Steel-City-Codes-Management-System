// Camp times are Denver times, whatever clock the viewer's device is on (spec 13). The chapter's
// time zone becomes a setting with spec 20; until then it's fixed here.
export const CAMP_TIME_ZONE = 'America/Denver'

function zonedParts(date: Date, timeZone = CAMP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

// Minutes the zone is ahead of UTC at that instant (Denver: −360 in summer, −420 in winter).
function offsetMinutes(date: Date, timeZone = CAMP_TIME_ZONE) {
  const p = zonedParts(date, timeZone)
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000
}

// "2027-02-06T09:00" typed as Denver time → ISO instant. Empty input → null.
export function campInputToISO(value: string): string | null {
  if (!value) return null
  const [d, t = '00:00'] = value.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, day, h, mi)
  let ts = guess - offsetMinutes(new Date(guess)) * 60000
  // Around a DST change the first guess can land on the other side; one correction settles it.
  const second = guess - offsetMinutes(new Date(ts)) * 60000
  if (second !== ts) ts = second
  return new Date(ts).toISOString()
}

// ISO instant → the "YYYY-MM-DDTHH:mm" a datetime-local input shows, in Denver time.
export function isoToCampInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const p = zonedParts(new Date(iso))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

// "Saturday, February 6 at 9:00 AM"
export function formatCampDateTime(iso: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }).format(d)
  const time = new Intl.DateTimeFormat('en-US', { timeZone: CAMP_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(d)
  return `${date} at ${time}`
}

// "3 days, 4 hours" · "2 hours, 5 minutes" · "45 seconds"
export function timeUntil(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
  if (days > 0) return hours > 0 ? `${unit(days, 'day')}, ${unit(hours, 'hour')}` : unit(days, 'day')
  if (hours > 0) return minutes > 0 ? `${unit(hours, 'hour')}, ${unit(minutes, 'minute')}` : unit(hours, 'hour')
  if (minutes > 0) return unit(minutes, 'minute')
  return unit(s, 'second')
}
