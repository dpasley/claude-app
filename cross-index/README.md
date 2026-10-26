# Cross-Index (prototype)

A self-contained browser app for working out a cross-indexing workflow by hand: intake of reports, main files (individuals, groups, subjects, areas), connections tied to their source reports, and a connections chart.

## Run it

Open `index.html` in a browser (double-click it). Nothing to install, no server, no build step. The chart library is included in `vendor/`, so it works offline.

## How it is organised

The menu follows the office: **New report** (the app opens here), **Files**, **Indexes**, **Chart**, **Leads**, **Investigations**, with Review and Settings off to the side. A search box in the header finds files, items and reports (by number or subject). There is no list of all reports; a file's page holds its reports.

- **Indexes** – the directory room, in four tabs. *Worth a look* (opens first, with a badge counting new discoveries): a row of tiles counts what the indexes show (new discoveries: a connection entered recently ties files together through a third file, or joins two separate groups, in a way no single report shows; shared items; files linked through others; names together with no connection; growing groups; loose ends; possible duplicates). Clicking a tile lists the findings as small pictures with an Open chart button. *Cross-filing*: the connection index of any file (also on a file's page), plus the standing cross-indexes of who and what is connected to each group, area, subject or individual. *Items*: plates, phones, emails, accounts and other things that are indexed rather than filed, by kind, with the files each is connected to. *Words used*: the wordings in connection notes with counts, for building a type list later. Discoveries use the date a connection was entered; growth uses the source report's date.

- **Reports** – the form follows the paper one: **date of report, subject of report, source of report**. Everything else (kind of source, event date, preserved copy, notes, original text with a SHA-256 fingerprint) is optional and folded under *More detail*. Saving takes you to the same report's page, which lists **the names mentioned** (pick an existing file or item as you type, add optional *identifying details* such as date of birth, address or nickname when creating a new file so same-named people can be told apart in the match list, arrow down to a match and press Enter to add; the chosen type stays selected for the next name) and **the connections** the report shows (from, plain-language type, to, a required note saying what the connection is; the list starts with just *Connected to*, with a tick box for the full list; the report is the source automatically). A pair can have several connections.
- **Items** – plates, phones, emails, online accounts, websites, financial accounts and anything else that is indexed rather than filed. An item has no folder; its entry lists the reports that mention it and its connections, like any file. Items are created from a report (type a plate or handle, choose *Item*, say what kind) and matching ignores case, spaces and punctuation, so "abc 1234" finds "ABC-1234". Stored as `Item` nodes with an `itemType` property.
- **Entities** – the main files. Name/alias matching helps resolve "same entity or new one?"; entities can be merged (with undo). Heat = independent reports in a recent window.
- **Chart** – directed, weighted connections graph. A *bank* is a saved view (starting entities, hops, filters) over the one main index; banks never copy data. Banks can be frozen as snapshots for handoff, and the live view then highlights what is new.
- **Situation observation** – shows which files moved in the last 7–90 days (more independent reports than the period before, or new links) and which files are active together. It only points; deciding something needs looking into is the staff member's call. "Open a bank" records why the bank was opened.
- **Investigations** – handing a bank over creates one investigation (`V-0001`) with its own status: Handed over, Investigating, Plan with legal, Executing, Closed. Each holds a simple handling plan (objective, outcome sought, actions with owners), one legal clearance for the whole plan (Cleared / Cleared with conditions / Returned), and execution, which cannot start until legal clears. A one-page plan sheet comes out as a PDF.
- **Case chart** – the investigators' picture of the major players and how they are related, for one investigation. It looks and prints like the working chart but shows only the main files chosen for it, laid out for the best view. Connections can be drawn by hand (each cites at least one report) or taken from what the main files already record. Free text labels and a title can be added for the wall copy. Open leads put a badge on the files they are about, so the board shows what is next. Anyone can edit it. "Pin to the case chart" / "Add to the case chart" on the working chart send things across for a handed-over bank.
- **Leads** – a lead is a question that comes out of a bank and its estimate. Kind: investigation (with Investigations) or data request (with Collection; retrieve and preserve only). Each names the bank, issued date, the report that raised it, a response and status. One-page lead sheets and an open-leads board come out as PDFs. Results come back through Intake: a report can say which lead it answers.
- **Estimate** (from the chart toolbar) – summary plus statements marked *established* (must cite reports) or *working theory*. "Hand over" freezes a snapshot so later findings show as changes.
- **Pictures** – individuals take a photo and groups a logo (Entity page). They are shrunk in the browser and stored on the entity (`photo`, a data URI), so they travel with the JSON export. Entities without one get a drawn placeholder.
- **Review** – the hesitation log: blocked saves, unclear entity types, flagged matches, created-despite-similar, and your own "Log a snag" notes.
- **Settings** – threat categories (intake basis), source types, connection types and their directions, heat and hub thresholds, data export/import.

### Connection types

Staff pick a plain label that reads as a sentence, *A [label] B* (Knows, Family of, Works for, Member of, Owns, Pays, Lives in, Seen at, Involved in, Connected to and others, grouped as People, Work, Groups, Corporate, Finance, Property and items, Places, Subjects and crime, General). The stored name is the label in UPPER_SNAKE_CASE (`FAMILY_OF`). Any pair of file or item types is allowed; the note says what kind. The list is added once to every data set (older names such as `FUNDED` stay under *Older names* because existing connections use them); staff can add a type on the spot from the report page, and *Settings → Restore the suggested list* adds back any that were deleted.

## Graph schema (Neo4j style)

The data is kept in the shape of a property graph so it can move to Neo4j later without redesign. Names follow Neo4j conventions: PascalCase labels, UPPER_SNAKE_CASE relationship types, camelCase properties.

| Kind | Name | Notes |
|---|---|---|
| Node label | `Individual`, `Group`, `Subject`, `Area` | the four main files; each has `id` (`E-0001`), `name`, `aliases`, `notes` |
| Node label | `Item` | an index entry, not a file: `id`, `name` (the identifier), `itemType` (plate, phone, email…), `aliases`, `notes` |
| Node label | `Report` | `id` (`R-0001`), `received` (date of report), `subject`, `eventDate`, `sourceType`, `sourceRef`, `basis`, `summary`, `hash`, `dupOf` |
| Node label | `Lead` | `id` (`L-0001`), `bankId`, `kind` (`INVESTIGATION`/`DATA_REQUEST`), `with`, `question`, `raisedBy` (report), `issued`, `status`, `response`; reports point back with `leadId` |
| Node label | `Bank` | a saved view (starting entities, filters, saved positions, `topN`, `estimate`, `handedOver`), not a copy |
| Node label | `Investigation` | `id` (`V-0001`), `bankId`, `status`, `investigator`, `notes`, `plan` (`objective`, `outcome`, `actions`, `legal`, `execution`), `caseChart` (`title`; `pins` of `entityId`/`x`/`y`; `strings` `C-0001` with `a`, `b`, `label`, `reportIds`; `notes` `W-0001` with `text`/`x`/`y`) |
| Relationship | `(:Report)-[:MENTIONS {role}]->(entity)` | role is one short word: `author`, `named`, `subject`, `payer`, `recipient`, `present` |
| Relationship | `(a)-[:FAMILY_OF {reportId, note}]->(b)` | one relationship per asserting report; never pre-merged; `note` says what the relationship is |
| Relationship types | `MEMBER_OF`, `WORKS_FOR`, `OWNS`, `PAYS`, `LIVES_IN`, `INVOLVED_IN`, … (see Connection types) | directed |
| Relationship types | `KNOWS`, `FAMILY_OF`, `LINKED_WITH`, `CONNECTED_TO`, … | stored with a fixed direction, queried ignoring it |

Files are ranked by *material* reports (the file is part of a recorded connection) rather than mentions, and high-connection files count for half, so a bank can show only its heaviest N files.

Weight is not stored. It is the count of distinct root reports on the relationships between two entities, which in Cypher is `count(DISTINCT rootReportId)`.

## How links and weights work

A link is one report's assertion (from, to, type, source report, optional note). A chart edge groups all links of the same type between the same two entities. **Weight = number of independent reports behind it**; reposts and duplicates count once with the original. Weight is computed, never typed, and there are no source grades or confidence statuses.

## Data

Stored in this browser only (localStorage). Use Settings → Export JSON for backups.
**Do not commit exports to this repository.** Export files contain report data; the repo is for code and the fictional sample data only (`.gitignore` blocks the default export file name).

## Hosting as a Claude artifact

`node build-artifact.js` writes `dist/cross-index-artifact.html`, a single self-contained page (git-ignored) that can be published as an artifact and used inside Claude. Browser pop-ups do not work there, so the app uses its own in-page dialogs and an Export dialog with Copy. PDFs (lead sheets, board, wall chart) are saved through the artifact's download permission, which asks the viewer first.

## Printing the chart for a wall

Chart → *Print for the wall…* splits the chart across tabloid (11 × 17) or letter pages, 1 to 4 across and down, with crop marks and page labels. Print the PDF at 100%, trim at the marks and tape the pages together. The arrangement of tiles is saved per bank (drag them); *Auto-arrange* resets it.

## Tests

`node tests/core.test.js` (logic), `node tests/pdf.test.js` (leads, estimate, ranking, PDFs, tile maths) and `node tests/chart.test.js` (chart elements and styles against the bundled Cytoscape in headless mode). Plain Node, nothing to install.
