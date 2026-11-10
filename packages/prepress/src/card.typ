// Print card template, shared by every deck. Deck data arrives as JSON.
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

// Category colours come from the deck, not from this template: build.mjs writes
// them from deck.json before compiling, so a new deck needs no edit here.
#import "../build/accents.typ": accent-color
// Field names, labels and item style come from the deck, written by build.mjs.
#import "../build/fields.typ": field-group, field-items, field-attribution, field-prompt, field-headline, field-context, field-anti, field-headline-size, field-card-id, label-items, label-prompt, label-context, item-style, blocks, group-label, figure-width, name-size

#let accent(card) = accent-color.at(card.at(field-group), default: rgb("#334155"))

// The front's long line. A deck may carry a per-card point size for it, so a
// card whose line is half as long again as its neighbours can step the type
// down instead of cutting the line. A deck that names no size field prints the
// 9 pt every earlier deck printed.
// The id a card prints. A deck may print the source's own id (the copy deck's
// ST-01) while the record keeps its deck id; a deck that names no such field
// prints card.id, as every earlier deck did.
#let printed-id(card) = if field-card-id != none and field-card-id in card {
  card.at(field-card-id)
} else {
  card.id
}

#let headline-size(card) = if field-headline-size != none and field-headline-size in card {
  card.at(field-headline-size) * 1pt
} else {
  9pt
}

// A declared field counts as absent when it prints nothing: an empty string, or
// an empty list. Without the list case, a record whose block is [] would print
// its label with nothing under it, which reads as a rendering fault.
#let absent(value) = if value == "" { true } else if type(value) == array { value.len() == 0 } else { false }

// One citation line. The ampersand must not end a printed line, so bind it to
// the surname it introduces. This is a typographic decision for this surface:
// the shared authorsLabel stays plain text and carries no non-printing
// characters. Every part of a citation is optional; an attribution that names
// no author, work or publication may still carry a note, which prints instead
// of an empty "Source: ." line.
#let citation-line(o) = {
  let names = (if "authorsLabel" in o { o.authorsLabel } else { "" }).replace(
    " & ", " &\u{00A0}"
  )
  let year-text = if "year" in o [ (#if o.year < 0 { str(-o.year) + " BCE" } else { str(o.year) })] else []
  let by = if names == "" [] else [#names#year-text.]
  let has-work = "title" in o
  let has-pub = "publication" in o
  let work = if has-work [ _#o.title#(o.titleStop)_] else []
  let pub = if has-pub [ #o.publication] else []
  let tail = if not has-work and not has-pub [] else if has-pub [ #work #pub.] else [ #work]
  let bare-cite = names == "" and not has-work and not has-pub
  if bare-cite and "note" in o { o.note } else { [Source: #by#tail] }
}

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
      [#text(size: 7pt, weight: "bold", fill: rgb("#64748b"))[#printed-id(card)]],
      [#text(size: 6.5pt, weight: "bold", fill: accent(card))[
        #group-label.at(card.at(field-group), default: upper(card.at(field-group)))
      ]],
    )
    #v(5pt)
    #text(size: name-size, weight: "bold", fill: rgb("#0f172a"))[#card.name]
    #v(4pt)
    #line(length: 100%, stroke: 1.5pt + accent(card))
    #v(6pt)
    #text(size: headline-size(card), style: "italic", fill: rgb("#334155"))[#card.at(field-headline)]
    #v(10pt)
    #align(center)[#image(card.svgFile, width: figure-width)]
    #v(10pt)
    #text(size: 7pt, weight: "bold", fill: rgb("#0f172a"))[#label-context]
    #v(2pt)
    #text(size: 7pt, fill: rgb("#475569"))[#card.at(field-context)]
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
    #text(size: 7pt, weight: "bold", fill: accent(card))[#printed-id(card)]
    #v(2pt)
    #text(size: 11pt, weight: "bold", fill: rgb("#0f172a"))[#card.name]
    #v(10pt)
    #if field-items != none and field-items in card and not absent(card.at(field-items)) [
      #text(size: 7.5pt, weight: "bold", fill: rgb("#0f172a"))[#label-items]
      #v(3pt)
      #for (i, item) in card.at(field-items).enumerate() [
        #grid(
          columns: (10pt, 1fr),
          if item-style == "steps" [
            #text(size: 7pt, weight: "bold", fill: accent(card))[#(i + 1)]
          ] else [
            #rect(width: 6pt, height: 6pt, stroke: 0.75pt + accent(card))
          ],
          [#text(size: 7pt)[#item.text]],
        )
        #v(3pt)
      ]
      #v(6pt)
    ]
    #if field-anti != none and field-anti in card [
      #text(size: 7.5pt, weight: "bold", fill: rgb("#0f172a"))[ANTI-PATTERN VS REMEDIATION]
      #v(2pt)
      #text(size: 6.5pt, fill: rgb("#b91c1c"))[Violation: #card.antiPattern.violation]
      #v(3pt)
      #text(size: 6.5pt, fill: rgb("#15803d"))[Fix: #card.antiPattern.remediation]
    ]
    // An optional fill-in-the-blank line. A deck that has none on a card gets
    // no heading, no gap and no mark: the whole block is absent, not empty.
    #if field-prompt != none and field-prompt in card and card.at(field-prompt) != "" [
      #v(6pt)
      #text(size: 7.5pt, weight: "bold", fill: rgb("#0f172a"))[#label-prompt]
      #v(2pt)
      #text(size: 6.5pt)[#card.at(field-prompt)]
    ]
    // The back-face blocks a deck declares, in its own order and under its own
    // labels. A deck that declares none renders none of this, which is what
    // keeps every earlier card's page identical.
    #if blocks.len() > 0 [
      #for b in blocks [
        #if b.field in card and not absent(card.at(b.field)) [
          #v(5pt)
          #text(size: 7.5pt, weight: "bold", fill: rgb("#0f172a"))[#b.label]
          #v(2pt)
          #if b.style == "traits" or b.style == "words" [
            #text(size: 7pt)[#card.at(b.field).join(" · ")]
          ] else if b.style == "quotes" [
            #text(size: 7pt)[#card.at(b.field).join("  ")]
          ] else if b.style == "prose" [
            #text(size: 7pt)[#card.at(b.field)]
          ] else if b.style == "list" [
            #for entry in card.at(b.field) [
              #grid(
                columns: (8pt, 1fr),
                [#text(size: 7pt, fill: accent(card))[·]],
                [#text(size: 7pt)[#entry]],
              )
            ]
          ] else if b.style == "example" [
            #text(size: 6.5pt, style: "italic")[#card.at(b.field)]
          ] else if b.style == "labelledList" [
            // An array of named things, one per line: a plan's stages, where
            // the label names the stage and the text says what happens.
            #for pair in card.at(b.field) [
              #text(size: 6.5pt, weight: "bold", fill: accent(card))[#pair.label] #text(size: 7pt)[#pair.text]
              #linebreak()
            ]
          ] else if b.style == "labelled" [
            // A record that carries its own label beside its text: the label
            // names the move, the text is what is said.
            #let pair = card.at(b.field)
            #text(size: 6.5pt, weight: "bold", fill: accent(card))[#pair.label]
            #v(1pt)
            #text(size: 7pt)[#pair.text]
          ]
        ]
      ]
    ]
    // A deck with no attribution has no source line: there is nothing to cite
    // and a heading over nothing would be a claim the record does not make.
    #if field-attribution != none and field-attribution in card [
      #v(8pt)
      #line(length: 100%, stroke: rule-stroke)
      #v(4pt)
      // Every part of a citation is optional. A named work with no author or no
      // year must not leave a dangling stop or an empty space; with all parts
      // present this prints the same line it always did. An origin may list
      // several works: each prints its own citation, in declaration order.
      #let o = card.at(field-attribution)
      #let works = if "works" in o { o.works } else { () }
      #text(size: 6.5pt, fill: rgb("#64748b"))[
        #if works.len() > 0 [
          #for (i, w) in works.enumerate() [
            #if i > 0 { linebreak() }
            #citation-line(w)
          ]
        ] else [
          #citation-line(o)
        ]
      ]
    ]
  ])
]

#for card in cards {
  page(margin: 0pt, recto(card))
  page(margin: 0pt, verso(card))
}
