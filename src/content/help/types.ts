// The shape of the in-app help (issue #186). Help text is data, so a test can walk every string
// and check that each link points at a real route and each "#topic" at a real topic.
//
// Text fields use a tiny inline markup (see markup.ts):
//   [[students]]          a link to an app page, labelled with that page's name (pages.ts)
//   [shown text](/path)   a link with its own text (a route, optionally with ?query or #topic)
//   **Make admin**        the exact name of a control, in bold

export type HelpRole = 'admin' | 'parent' | 'volunteer'

export type HelpBlock =
  // A plain paragraph.
  | { kind: 'p'; text: string }
  // Numbered steps the reader follows in order.
  | { kind: 'steps'; heading?: string; items: string[] }
  // "What the system does for you": what happens without anyone doing it.
  | { kind: 'system'; items: string[] }
  // A short list that isn't a sequence.
  | { kind: 'list'; heading?: string; items: string[] }

export interface HelpTopic {
  // Unique within its guide; the topic's anchor (/admin/help#<id>).
  id: string
  // Says what the reader is trying to do or what went wrong, in their words.
  title: string
  body: HelpBlock[]
  // Extra words people might search for that the text doesn't use.
  keywords?: string
}

export interface HelpSection {
  id: string
  title: string
  intro?: string
  topics: HelpTopic[]
}

export interface HelpGuide {
  role: HelpRole
  // The route the guide lives at.
  path: string
  title: string
  intro: string
  sections: HelpSection[]
}

// A contextual tip: the "How this works" disclosure a page can put next to a confusing control.
export interface HelpTip {
  role: HelpRole
  // The page and control the tip belongs beside, for whoever adopts it.
  where: string
  // The disclosure's label; "How this works" when left out.
  label?: string
  body: string[]
  // The help topic that says more (a route with a #topic).
  more?: string
}
