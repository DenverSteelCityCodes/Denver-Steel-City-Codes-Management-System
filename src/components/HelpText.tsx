import { Link } from 'react-router-dom'
import { parseHelpText } from '../content/help/markup'

// Renders one help string (content/help/types.ts): page links as router links, control names
// in bold. Links are underlined text, never colour alone.
export default function HelpText({ text }: { text: string }) {
  return (
    <>
      {parseHelpText(text).map((t, i) =>
        t.kind === 'link' ? (
          <Link key={i} to={t.to} className="font-bold text-ink underline underline-offset-[3px] decoration-[1.5px] hover:decoration-[3px]">
            {t.text}
          </Link>
        ) : t.kind === 'strong' ? (
          <b key={i} className="font-bold text-ink">{t.text}</b>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </>
  )
}
