/*
 * The law-section map: the source's five taxonomy sections and their laws,
 * held to a deck's records by name rather than by ordinal.
 *
 * The map exists so a card's category stops being an assertion. Each entry
 * carries the source's number, the heading as the source prints it, and the
 * deck category a human read from the section heading. Where the deck calls a
 * law something else, the entry also carries the deck's own word for it.
 *
 * Matching is by normalised name. An ordinal key would compare the map against
 * itself: if the source's numbering and the record's category were both wrong,
 * an ordinal join would still agree. Names from two documents do not.
 *
 * NORMALISATION_RULES is printed into the map's header. The implementation of
 * each rule is normaliseLawName below, so the prose and the code sit together;
 * a future reader who changes one sees the other.
 */

export const NORMALISATION_RULES = [
  {
    rule: "Unicode NFKC, then curly single and double quotes become straight ones.",
    edgeCase:
      "Composed and decomposed spellings of Prägnanz key the same; 'Jakob’s' and \"Jakob's\" key the same, while 'Jakobs' stays different because the apostrophe is kept as a word break, not deleted."
  },
  {
    rule: "Lower-case with String.prototype.toLowerCase.",
    edgeCase:
      "Case folding is applied after the quote replacement, so a law whose name differs only in case across the two documents still keys the same."
  },
  {
    rule: "Drop one parenthetical group that ends the name, with the whitespace before it.",
    edgeCase:
      "A parenthetical in the middle is kept: 'Foo (bar) Baz' keeps (bar). Of two trailing groups, 'Foo (a) (b)' drops only (b); (a) remains text. This is what lets 'Tesler’s Law (Law of Conservation of Complexity)' key to the record 'Tesler’s Law'."
  },
  {
    rule: "Replace every run of characters outside [a-z0-9] with one space, then trim.",
    edgeCase:
      "Hyphen, slash, period and comma all become the same space, so 'Figure/Ground', 'Figure-Ground' and 'Figure Ground' are one key. That is why the map asserts key uniqueness rather than assuming it."
  }
];

const toKey = (name) =>
  name
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s*\([^()]*\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const normaliseLawName = (name) => toKey(name);

// Every key a row can be found by: its source name and, where the deck renamed
// the law, the deck's own word.
export const rowKeys = (row) => {
  const keys = [toKey(row.sourceName)];
  if (row.deckName !== undefined) keys.push(toKey(row.deckName));
  return keys;
};

/*
 * Check a map against a deck's records in both directions. Returns the problems
 * (empty when the map and the records agree) and the counts the gate reports:
 * rows, and how many rows carry a deckName. The count is measured here so no
 * caller has to know or type it.
 */
export function checkSectionMap(records, map) {
  const problems = [];
  const rows = map.laws || [];
  const byKey = new Map();
  const keyOwners = new Map();

  for (const row of rows) {
    if (!Number.isInteger(row.number)) {
      problems.push(`map row ${JSON.stringify(row.sourceName)} has no integer number`);
    }
    const keys = rowKeys(row);
    for (const key of keys) {
      if (!key) {
        problems.push(`map row ${row.number} ${row.sourceName} has an empty key`);
        continue;
      }
      const owners = keyOwners.get(key) || [];
      owners.push(row.number);
      keyOwners.set(key, owners);
    }
    byKey.set(row.number, row);
  }

  for (const [key, owners] of keyOwners) {
    if (owners.length > 1) {
      const named = owners.map((number) => {
        const row = byKey.get(number);
        return `${number} ${row.sourceName}${row.deckName ? ` (deck: ${row.deckName})` : ""}`;
      });
      problems.push(`key "${key}" is shared by rows ${named.join(" and ")}`);
    }
  }

  const matched = new Map();
  for (const record of records) {
    const key = toKey(record.name);
    const owners = keyOwners.get(key);
    if (!owners) {
      problems.push(`${record.id} "${record.name}" matches no row (key "${key}")`);
      continue;
    }
    if (owners.length > 1) {
      // Already reported as a shared key; naming the record here says which
      // record the collision made ambiguous.
      problems.push(`${record.id} "${record.name}" matches ${owners.length} rows`);
      continue;
    }
    const row = byKey.get(owners[0]);
    matched.set(row.number, (matched.get(row.number) || 0) + 1);
    if (record.category !== row.category) {
      problems.push(
        `${record.id} category "${record.category}" disagrees with row ${row.number} ${row.sourceName}: "${row.category}"`
      );
    }
  }

  for (const row of rows) {
    const count = matched.get(row.number) || 0;
    if (count !== 1) {
      problems.push(`row ${row.number} ${row.sourceName} is matched by ${count} records, not exactly one`);
    }
  }

  // The header's rename list is a written summary of the deckName rows, and an
  // unchecked summary above tested data is how a map starts lying: someone
  // renames a law in laws and forgets the list, or edits the list alone. Hold
  // it to the rows exactly - same triples, same order, none missing, none extra.
  const renamed = rows
    .filter((row) => row.deckName !== undefined)
    .map((row) => ({ number: row.number, sourceName: row.sourceName, deckName: row.deckName }));
  const listed = map.header?.renames;
  if (!Array.isArray(listed)) {
    problems.push("header.renames is missing, so the rename list above the rows is unreadable");
  } else {
    const depth = Math.max(listed.length, renamed.length);
    for (let i = 0; i < depth; i += 1) {
      const listedRow = listed[i];
      const row = renamed[i];
      if (!row) {
        problems.push(
          `header.renames[${i}] lists ${listedRow.number} ${listedRow.sourceName}, but no row there carries deckName`
        );
      } else if (!listedRow) {
        problems.push(
          `header.renames is missing row ${row.number} ${row.sourceName} (deck: ${row.deckName})`
        );
      } else if (
        listedRow.number !== row.number ||
        listedRow.sourceName !== row.sourceName ||
        listedRow.deckName !== row.deckName
      ) {
        problems.push(
          `header.renames[${i}] is ${listedRow.number} ${listedRow.sourceName} -> ${listedRow.deckName}, ` +
            `but the row is ${row.number} ${row.sourceName} -> ${row.deckName}`
        );
      }
    }
  }

  return {
    problems,
    rows: rows.length,
    deckNamed: rows.filter((row) => row.deckName !== undefined).length
  };
}
