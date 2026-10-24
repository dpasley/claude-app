# Cross-Index (prototype)

A self-contained browser app for working out a cross-indexing workflow by hand: intake of reports, entity files (individuals, groups, subjects, locations), connections tied to their source reports, and a connections chart.

## Run it

Open `index.html` in a browser (double-click it). Nothing to install, no server, no build step. The chart library is included in `vendor/`, so it works offline.

## How it is organised

- **Reports** – intake form (source, intake basis, repost-of, summary, optional original text with a SHA-256 fingerprint), then indexing: add the entities the report mentions, then the connections it asserts.
- **Entities** – the main files. Name/alias matching helps resolve "same entity or new one?"; entities can be merged (with undo). Heat = independent reports in a recent window.
- **Chart** – directed, weighted connections graph. A *bank* is a saved view (starting entities, hops, filters) over the one main index; banks never copy data. Banks can be frozen as snapshots for handoff, and the live view then highlights what is new.
- **Review** – the hesitation log: blocked saves, unclear entity types, flagged matches, created-despite-similar, and your own "Log a snag" notes.
- **Settings** – threat categories (intake basis), source types, connection types and their directions, heat and hub thresholds, data export/import.

## Graph schema (Neo4j style)

The data is kept in the shape of a property graph so it can move to Neo4j later without redesign. Names follow Neo4j conventions: PascalCase labels, UPPER_SNAKE_CASE relationship types, camelCase properties.

| Kind | Name | Notes |
|---|---|---|
| Node label | `Individual`, `Group`, `Subject`, `Location` | the four main files; each has `id` (`E-0001`), `name`, `aliases`, `notes` |
| Node label | `Report` | `id` (`R-0001`), `received`, `eventDate`, `sourceType`, `sourceRef`, `basis`, `summary`, `hash`, `dupOf` |
| Node label | `Lead`, `Bank` | planned: a lead points at what raised it and at the reports that answered it; a bank is a saved set of starting entities and filters, not a copy |
| Relationship | `(:Report)-[:MENTIONS {role}]->(entity)` | role is one short word: `author`, `named`, `subject`, `payer`, `recipient`, `present` |
| Relationship | `(a)-[:FUNDED {reportId, note}]->(b)` | one relationship per asserting report; never pre-merged |
| Relationship types | `EMPLOYED_BY`, `MEMBER_OF`, `CONTROLS`, `FUNDED`, `LOCATED_AT`, `INVOLVED_IN`, `ACTED_AGAINST` | directed |
| Relationship types | `COMMUNICATED_WITH`, `ASSOCIATED_WITH` | stored with a fixed direction, queried ignoring it |

Weight is not stored. It is the count of distinct root reports on the relationships between two entities, which in Cypher is `count(DISTINCT rootReportId)`.

## How links and weights work

A link is one report's assertion (from, to, type, source report, optional note). A chart edge groups all links of the same type between the same two entities. **Weight = number of independent reports behind it**; reposts and duplicates count once with the original. Weight is computed, never typed, and there are no source grades or confidence statuses.

## Data

Stored in this browser only (localStorage). Use Settings → Export JSON for backups.
**Do not commit exports to this repository.** Export files contain report data; the repo is for code and the fictional sample data only (`.gitignore` blocks the default export file name).

## Hosting as a Claude artifact

`node build-artifact.js` writes `dist/cross-index-artifact.html`, a single self-contained page (git-ignored) that can be published as an artifact and used inside Claude. Browser pop-ups and file downloads do not work there, so the app uses its own in-page dialogs and an Export dialog with Copy.

## Tests

`node tests/core.test.js` (logic) and `node tests/chart.test.js` (chart elements and styles against the bundled Cytoscape in headless mode). Plain Node, nothing to install.
