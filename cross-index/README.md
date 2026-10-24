# Cross-Index (prototype)

A self-contained browser app for working out a cross-indexing workflow by hand: intake of reports, entity files (individuals, groups, subjects, locations), connections tied to their source reports, and a connections chart.

## Run it

Open `index.html` in a browser (double-click it). Nothing to install, no server, no build step. The chart library is included in `vendor/`, so it works offline.

## How it is organised

- **Reports** – intake form (source, intake basis, repost-of, summary, optional original text with a SHA-256 fingerprint), then indexing: add the entities the report mentions, then the connections it asserts.
- **Entities** – the main files. Name/alias matching helps resolve "same entity or new one?"; entities can be merged (with undo). Heat = independent reports in a recent window.
- **Chart** – directed, weighted connections graph. A *bank* is a saved view (starting entities, hops, filters) over the one main index; banks never copy data. Banks can be frozen as snapshots for handoff, and the live view then highlights what is new.
- **Leads** – a lead is a question that comes out of a bank and its estimate. Kind: investigation (with Investigations) or data request (with Collection; retrieve and preserve only). Each names the bank, issued date, the report that raised it, a response and status. One-page lead sheets and an open-leads board come out as PDFs. Results come back through Intake: a report can say which lead it answers.
- **Estimate** (from the chart toolbar) – summary plus statements marked *established* (must cite reports) or *working theory*. "Hand over" freezes a snapshot so later findings show as changes.
- **Pictures** – individuals take a photo and groups a logo (Entity page). They are shrunk in the browser and stored on the entity (`photo`, a data URI), so they travel with the JSON export. Entities without one get a drawn placeholder.
- **Review** – the hesitation log: blocked saves, unclear entity types, flagged matches, created-despite-similar, and your own "Log a snag" notes.
- **Settings** – threat categories (intake basis), source types, connection types and their directions, heat and hub thresholds, data export/import.

## Graph schema (Neo4j style)

The data is kept in the shape of a property graph so it can move to Neo4j later without redesign. Names follow Neo4j conventions: PascalCase labels, UPPER_SNAKE_CASE relationship types, camelCase properties.

| Kind | Name | Notes |
|---|---|---|
| Node label | `Individual`, `Group`, `Subject`, `Location` | the four main files; each has `id` (`E-0001`), `name`, `aliases`, `notes` |
| Node label | `Report` | `id` (`R-0001`), `received`, `eventDate`, `sourceType`, `sourceRef`, `basis`, `summary`, `hash`, `dupOf` |
| Node label | `Lead` | `id` (`L-0001`), `bankId`, `kind` (`INVESTIGATION`/`DATA_REQUEST`), `with`, `question`, `raisedBy` (report), `issued`, `status`, `response`; reports point back with `leadId` |
| Node label | `Bank` | a saved view (starting entities, filters, saved positions, `topN`, `estimate`, `handedOver`), not a copy |
| Relationship | `(:Report)-[:MENTIONS {role}]->(entity)` | role is one short word: `author`, `named`, `subject`, `payer`, `recipient`, `present` |
| Relationship | `(a)-[:FUNDED {reportId, note}]->(b)` | one relationship per asserting report; never pre-merged |
| Relationship types | `EMPLOYED_BY`, `MEMBER_OF`, `CONTROLS`, `FUNDED`, `LOCATED_AT`, `INVOLVED_IN`, `ACTED_AGAINST` | directed |
| Relationship types | `COMMUNICATED_WITH`, `ASSOCIATED_WITH` | stored with a fixed direction, queried ignoring it |

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
