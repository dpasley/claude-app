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

## How links and weights work

A link is one report's assertion (from, to, type, source report, optional note). A chart edge groups all links of the same type between the same two entities. **Weight = number of independent reports behind it**; reposts and duplicates count once with the original. Weight is computed, never typed, and there are no source grades or confidence statuses.

## Data

Stored in this browser only (localStorage). Use Settings → Export JSON for backups.
**Do not commit exports to this repository.** Export files contain report data; the repo is for code and the fictional sample data only (`.gitignore` blocks the default export file name).

## Tests

`node tests/core.test.js` (logic) and `node tests/chart.test.js` (chart elements and styles against the bundled Cytoscape in headless mode). Plain Node, nothing to install.
