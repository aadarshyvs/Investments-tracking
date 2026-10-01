# Folio — personal portfolio tracker

A responsive, single-page HTML portfolio tracker for Indian investors. Open `index.html` on GitHub Pages or any static HTTPS host. The interface uses no build step or installed JavaScript packages.

## Features

- INR entry and display for every asset, including US stocks (the underlying USD quote and purchase FX are retained for accurate basis calculations).
- Purchase lots, editable full/partial sales, dividends, manual prices, realized and unrealized gains, XIRR, portfolio history, analytics, forecasts and JSON/CSV exports.
- NSE, BSE and US stock search/history via the included Apps Script gateway, mutual fund NAV via MFAPI, metal spot estimates via Gold API and reference FX via Frankfurter. Data sources may be delayed or unavailable; manually entered prices are labelled.
- Optional dark/light theme, responsive navigation, keyboard focus styles and reduced-motion support.
- Automatic shared portfolio sync with revision conflict protection after the backend is connected. Offline edits queue locally; unresolved conflicts never overwrite a device's edits silently.

## One-time cloud setup

The static HTML alone cannot share private data between devices. Follow these steps to enable your Google Drive-backed shared portfolio and stock price gateway. Your web page must use HTTPS for Google Sign-In.

1. In [Google Cloud Console](https://console.cloud.google.com/auth/overview), select/create a project. Under **Google Auth Platform → Branding**, enter an app name and support email. Under **Audience**, choose **External**. If the app remains in Testing, add your Google email under **Test users**. Under **Clients**, create a **Web application** OAuth client.
2. Add your hosted origin to **Authorized JavaScript origins**. For the repository owner's GitHub Pages site, it is `https://aadarshyvs.github.io` (origin only, without the repository path). Copy the Web client ID ending in `.apps.googleusercontent.com`. The sign-in button requests an ID token for identity; this app does not ask the browser for Google Drive scopes.
3. In [Google Apps Script](https://script.google.com/home/start), create a new project, replace the default `Code.gs` with [apps-script/Code.gs](apps-script/Code.gs), and save.
4. Open Apps Script **Project Settings → Script Properties** and add:

   | Property | Value |
   | --- | --- |
   | `SYNC_KEY` | Random key of at least 32 characters, generated in Folio Settings |
   | `GOOGLE_CLIENT_ID` | The Web client ID from step 2 |
   | `ALLOWED_EMAILS` | Your allowed Google email addresses, separated by commas |
   | `SESSION_HOURS` | Optional; default `1`, maximum `24` |

5. Select `initialize` in the Apps Script editor and click **Run**. Authorize your own script to create a private JSON file in your Google Drive. Review the script before approving permissions.
6. Select **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then deploy. The web app is publicly callable, but portfolio read/write requests require *both* an allowed Google ID token and your `SYNC_KEY`. Use the `/exec` URL. If you edit `Code.gs` later, choose **Deploy → Manage deployments → Edit → New version**; saving source alone does not update the deployed URL.
7. On your first device, open Folio **Settings & sync**, enter the `/exec` URL, the Web client ID and your key. Save, sign in with an allowed Google account, then Test connection. If you already have local entries, choose Upload to cloud after reviewing them. On another device, open the *same hosted URL*, enter the same URL, client ID and key, sign in and choose Download from cloud. Later changes sync automatically when connected. Keep JSON backups.

The browser keeps a local offline cache. If another device changed the cloud revision while you were offline, Folio preserves your local edits and asks you to review the cloud version. The backend stores one previous revision for recovery. Google Sign-In controls cloud access; the browser cache is not encrypted. Use a device profile you trust.

## Market data and calculations

Stock quotes come from Yahoo Finance's unofficial public endpoints through Apps Script. They can be delayed or blocked. Mutual funds use [MFAPI](https://www.mfapi.in/docs/), spot metal estimates use [Gold API](https://gold-api.com/docs), and daily reference currency conversion uses [Frankfurter](https://frankfurter.dev/). Indicative international metal spot converted to INR per gram is not a retail or exchange settlement price. Missing historical prices/FX produce chart gaps rather than invented returns. Projections, break-even extrapolations and risk heuristics are descriptive tools, not investment advice.

## Backups and updates

Use **Settings → Download JSON backup** before changing browsers, clearing site data or replacing a portfolio. The import accepts Folio JSON backups, validates rows and previews counts before replacement.

### Migrate the old PORTFOL.IO sheet

The legacy app stored `Holdings` rows with `id, name, type, symbol, units, buyPrice, buyDate, currency, notes, soldPrice, soldDate, soldNotes, status` in Google Sheets and mirrored them to `pf_data` in the browser. The new app can migrate either source without editing or deleting it:

1. Open the old Google Sheet in the Google account that owns it. Select **Holdings** and choose **File → Download → Comma Separated Values (.csv)**. If dates appear as ambiguous day/month strings, format the `buyDate` and `soldDate` columns as `YYYY-MM-DD` first. Alternatively, open the old Apps Script `/exec` URL with that account and save its JSON response to a `.json` file. If you used the old and new app on the same GitHub Pages origin and browser, the importer can read the old `pf_data` cache directly.
2. In Folio, open **Settings → Backups & portability → Migrate legacy PORTFOL.IO**. Set a USD/INR assumption if the old portfolio contains US stocks, select the CSV/JSON, or preview the available browser copy.
3. Review row counts and warnings, export the current Folio backup, then choose **Add legacy records**. The importer adds records with stable IDs, skips exact repeats, and rejects changed duplicates without partially writing. Existing Folio records stay intact. Download the cloud portfolio first if this device has never read a configured cloud account.
4. Compare active units, closed-trade proceeds, notes and INR P&L against the old app. Refresh prices and correct individual US buy/sale FX rates if you know them. Keep the old sheet and exported CSV/JSON until you have verified the migration and cloud sync.

The old sheet did not store actual historical USD/INR rates, dividend entries, chart history, or manually updated `Other` prices. The browser copy may contain those `Other` prices. Old partial sales are separate closed rows; the importer keeps each row as its own lot to preserve cost and realized gains. Financial records are never embedded in this public repository; transfer them with a private file or the same-browser cache.

The app is `index.html`; GitHub Pages can serve it directly from the `main` branch root. The backend is `apps-script/Code.gs`, also embedded inside the app's Copy Script button.
