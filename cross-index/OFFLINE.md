# Using Cross-Index offline

The app and your data are kept apart:

- **The app** is one file: `offline/cross-index.html`. Replace it whenever there is a new version.
- **Your data** is a separate file, `cross-index-data.json`, that you create once and keep somewhere else on your computer (not inside the app folder, and never in the GitHub repository).

## First time
1. Download `offline/cross-index.html` from GitHub and put it in an app folder, e.g. `Documents/CrossIndex-app/`.
2. Open it in **Chrome or Edge**.
3. Click **Create a new one** (top banner or Settings > Data file). Choose a data folder, e.g. `Documents/CrossIndex-data/`. This removes the sample data and starts your own.
4. Work as normal. Every change is saved to the data file within a second.

## Each time you open the app
Click **Reconnect** in the banner once (the browser asks permission each session). If you have an existing data file, use **Open my data file**.

## Updating the app
Download the new `cross-index.html`, replace the old one, open it, click Reconnect. Your data file is untouched; older data is upgraded automatically when loaded.

## Safety
- Back up the data file regularly (copy it, or use Settings > Backup and import > Export).
- A copy is also kept in the browser, but the data file is the one that matters.
- Firefox and Safari cannot write to a file; there, use Export for backups.
