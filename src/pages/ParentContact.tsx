import ContactDetailsCard from '../components/ContactDetailsCard'

// Your contact details, from the avatar menu: an inline page, not a modal.
export default function ParentContact() {
  return (
    <div className="max-w-[640px] mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-12">
      <h1 className="font-display text-[1.75rem] leading-[1.15] font-bold tracking-[-0.01em] text-balance">Your contact details</h1>
      <p className="mt-2 mb-6 text-ink-muted text-pretty">How the camp reaches you about every camper on this account.</p>
      <ContactDetailsCard />
    </div>
  )
}
