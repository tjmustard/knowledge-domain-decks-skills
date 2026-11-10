// UX & Behavioral Design — print card template.
//
// Page = trim + bleed: 2.75 x 4.75 in trim with 0.125 in bleed on every side
// gives a 3.00 x 5.00 in page box. Content sits inside a 0.1875 in safe inset
// measured from the trim line (0.3125 in from the page edge). Crop ticks are
// drawn inside the bleed, at the trim corners, because the page box itself is
// the bleed box in this slice.
//
// One card renders per page: recto then verso.

#set page(width: 3in, height: 5in, margin: 0pt, fill: white)

#let cards = json("../build/cards.json")

#let w = 3in
#let h = 5in
#let trim = 0.125in
#let safe = 0.3125in
#let cw = w - 2 * safe
#let ch = h - 2 * safe
#let mark-stroke = 0.25pt + rgb("#94a3b8")
#let rule-stroke = 0.5pt + rgb("#e2e8f0")

#let accent-color = (
  "Heuristic & Mental Models": rgb("#1E3A8A"),
  "Gestalt & Visual Perception": rgb("#065F46"),
  "Decision-Making & Cognitive Load": rgb("#78350F"),
  "Time, Motion & Ergonomics": rgb("#831843"),
  "Memory, Perception & Attention": rgb("#312E81"),
)

#let accent(card) = accent-color.at(card.category, default: rgb("#334155"))

// Trim ticks and trim outline, all within the bleed band.
#let marks() = [
  #place(top + left, line(start: (0pt, trim), end: (trim, trim), stroke: mark-stroke))
  #place(top + left, line(start: (trim, 0pt), end: (trim, trim), stroke: mark-stroke))
  #place(top + left, line(start: (w - trim, trim), end: (w, trim), stroke: mark-stroke))
  #place(top + left, line(start: (w - trim, 0pt), end: (w - trim, trim), stroke: mark-stroke))
  #place(top + left, line(start: (0pt, h - trim), end: (trim, h - trim), stroke: mark-stroke))
  #place(top + left, line(start: (trim, h - trim), end: (trim, h), stroke: mark-stroke))
  #place(top + left, line(start: (w - trim, h - trim), end: (w, h - trim), stroke: mark-stroke))
  #place(top + left, line(start: (w - trim, h - trim), end: (w - trim, h), stroke: mark-stroke))
  #place(top + left, dx: trim, dy: trim, rect(
    width: w - 2 * trim,
    height: h - 2 * trim,
    stroke: 0.25pt + rgb("#e5e7eb"),
  ))
]

#let recto(card) = [
  #marks()
  #place(top + left, dx: 0pt, dy: 0pt, rect(
    width: w,
    height: 0.2in,
    fill: accent(card),
  ))
  #place(top + left, dx: safe, dy: safe, block(width: cw, height: ch, inset: 0pt)[
    #set text(size: 7pt, fill: rgb("#334155"))
    #grid(
      columns: (1fr, auto),
      [#text(size: 7pt, weight: "bold", fill: rgb("#64748b"))[#card.id]],
      [#text(size: 6.5pt, weight: "bold", fill: accent(card))[#upper(card.category)]],
    )
    #v(5pt)
    #text(size: 14pt, weight: "bold", fill: rgb("#0f172a"))[#card.name]
    #v(4pt)
    #line(length: 100%, stroke: 1.5pt + accent(card))
    #v(6pt)
    #text(size: 9pt, style: "italic", fill: rgb("#334155"))[#card.axiom]
    #v(10pt)
    #align(center)[#image(card.svgFile, width: 1.8in)]
    #v(10pt)
    #text(size: 7pt, weight: "bold", fill: rgb("#0f172a"))[WHEN TO APPLY]
    #v(2pt)
    #text(size: 7pt, fill: rgb("#475569"))[#card.trigger]
  ])
]

#let verso(card) = [
  #marks()
  #place(top + left, dx: 0pt, dy: 0pt, rect(
    width: w,
    height: 0.2in,
    fill: accent(card),
  ))
  #place(top + left, dx: safe, dy: safe, block(width: cw, height: ch, inset: 0pt)[
    #set text(size: 7pt, fill: rgb("#334155"))
    #text(size: 7pt, weight: "bold", fill: accent(card))[#card.id]
    #v(2pt)
    #text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[#card.name]
    #v(10pt)
    #text(size: 7.5pt, weight: "bold", fill: rgb("#0f172a"))[OPERATIONAL CHECKLIST]
    #v(3pt)
    #for item in card.checklist [
      #grid(
        columns: (10pt, 1fr),
        [#rect(width: 6pt, height: 6pt, stroke: 0.75pt + accent(card))],
        [#text(size: 7pt)[#item]],
      )
      #v(3pt)
    ]
    #v(6pt)
    #text(size: 7.5pt, weight: "bold", fill: rgb("#0f172a"))[ANTI-PATTERN VS REMEDIATION]
    #v(2pt)
    #text(size: 6.5pt, fill: rgb("#b91c1c"))[Violation: #card.antiPattern.violation]
    #v(3pt)
    #text(size: 6.5pt, fill: rgb("#15803d"))[Fix: #card.antiPattern.remediation]
    #v(8pt)
    #line(length: 100%, stroke: rule-stroke)
    #v(4pt)
    #text(size: 5.5pt, fill: rgb("#64748b"))[
      Source: #card.academicOrigin.authors.join(", ") (#card.academicOrigin.year).
      _#card.academicOrigin.title._ #card.academicOrigin.publication.
    ]
  ])
]

#for card in cards {
  page(margin: 0pt, recto(card))
  page(margin: 0pt, verso(card))
}
