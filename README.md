# HIDECOR SiteLog — Mobile (PWA)

A mobile Daily Progress Report app for site engineers. Site photographs with work
descriptions are the centre of it; progress %, manpower, approvals and tomorrow's
plan feed the same report, which goes out as a PDF.

Works fully offline — which matters, because the inside of a building under fit-out
rarely has signal.

---

## What's in this folder

```
index.html           the app shell
manifest.json        web app manifest (icons, screenshots, shortcuts)
sw.js                service worker — precaches the shell for offline use
offline.html         shown only if the app is opened before it has ever loaded
css/app.css          styles
js/core.js           storage (IndexedDB), data model, photo pipeline
js/pdf.js            PDF writer — no external library
js/report.js         DPR document model + PDF/HTML renderers
js/app.js            the interface
icons/               app icons, including maskable and apple-touch
screenshots/         store listing screenshots
```

No frameworks, no CDN, no build step, no network calls. Everything is served from
this folder.

---

## Step 1 — Put it on an HTTPS address

A PWA will not install and the service worker will not run without HTTPS.
`file://` will not work. Any static host will do; all of these are free:

| Host | How |
|---|---|
| **Netlify Drop** | Go to `app.netlify.com/drop` and drag this folder in. Done in about a minute, gives you an HTTPS URL. |
| **GitHub Pages** | See `GITHUB_DEPLOY.md` in this folder — a full step-by-step, done entirely in the browser. |
| **Cloudflare Pages / Vercel** | Connect the repo, no build command, output directory is this folder. |
| **Your own server** | Copy the folder to any HTTPS path. It is fully relative, so a sub-folder works. |

Open the URL on your phone and check that it loads, then turn flight mode on and
reload — it should still open. That is the offline cache working.

**Using it as-is:** at this point the app is already usable. On Android, Chrome
offers "Install app"; on iPhone, Safari → Share → **Add to Home Screen**. It then
behaves like any other app. Many teams stop here and never package it at all.

---

## Step 2 — Package with PWABuilder

Go to **pwabuilder.com**, paste the HTTPS URL, and press Start.

It will report a score for manifest, service worker and security. This build is set
up to pass all of them — if anything is flagged, it is almost always because the
host is not serving `manifest.json` as `application/manifest+json`, which is
harmless.

### Android (Google Play)

1. Press **Package for stores → Android**.
2. Choose **Google Play** (this produces a Trusted Web Activity).
3. Suggested values:
   - Package ID: `in.hidecor.sitelog`
   - App name: `HIDECOR SiteLog`
   - Short name: `SiteLog`
   - Version: `1.0.0`, version code `1`
   - Signing key: **Create new** — then **keep the downloaded `.keystore` file and
     its passwords somewhere safe.** Lose it and you can never update the app on
     Play; you would have to publish under a new listing.
4. You get a zip with `app-release-bundle.aab` (upload this to Play) and
   `assetlinks.json`.
5. **Upload `assetlinks.json` to your host at `/.well-known/assetlinks.json`.**
   Skip this and the app opens with a browser address bar across the top. This is
   the single most common packaging mistake.
6. In Play Console: create the app, upload the `.aab`, fill the store listing
   (the screenshots in `screenshots/` are sized for it), and complete the
   content rating and data-safety forms.

Since this app stores everything on the device and makes no network calls, the
data-safety form is short: no data collected, no data shared.

### iPhone and iPad (App Store)

1. Press **Package for stores → iOS**.
2. You get an Xcode project, not a finished app.
3. Building and submitting it needs a **Mac with Xcode** and an **Apple Developer
   account ($99/year)**.

**Be aware before you start:** Apple's review guideline 4.2 rejects apps that are
simply a website in a wrapper. A DPR app that captures photos through the camera,
works offline and generates PDFs on-device has a reasonable case, but rejection is
a real possibility and it is usually resolved by argument and resubmission rather
than by a code change.

**The practical alternative** — and what I would suggest for an internal tool used
by your own site staff — is to skip the App Store. On iPhone, Safari → Share →
**Add to Home Screen** installs the same app, full screen, with its own icon, no
developer account, no review, and updates land the moment you redeploy. Your
engineers get the identical app; you just don't pay Apple or wait for review.

---

## Updating the app later

1. Change the files.
2. Bump `CACHE` in `sw.js` (`sitelog-v1.0.0` → `sitelog-v1.0.1`) — this is what
   tells installed phones to fetch the new version.
3. Redeploy.

Phones pick it up on the next launch. If you published to Play, a store update is
only needed when you change the icon, name or permissions — the app content itself
updates from your host.

---

## How the data is held

- Everything lives in **IndexedDB on the phone**. Photos are stored as compressed
  JPEG blobs, which is why localStorage is not used — a day of photos runs well past
  its 5 MB limit.
- The app asks for **persistent storage** on first launch so the browser does not
  evict the data when space runs low.
- Nothing is uploaded anywhere. There is no server and no account.
- **This means a backup is not optional.** More → Backup exports one JSON file with
  every project, report and photo. Take one weekly and keep it in Drive or on the
  office machine. If the phone is lost or its browser data is cleared, that file is
  the only way back.

A shared server with sync between site and office would be a different build — say
so if that is where this needs to go.

---

## Notes for whoever maintains this

- `js/pdf.js` writes PDFs byte by byte using the base-14 Helvetica fonts, so there
  is nothing to embed and no library to keep up to date. Photos go in as JPEG via
  `DCTDecode`, de-duplicated by content.
- Rates are **off by default** everywhere. `DB.settings.showRates` gates the BOQ
  values, the change-order amounts and the commercial block; the internal copy is
  stamped `INTERNAL COPY` in the PDF footer and `_INTERNAL` in the filename so the
  two can never be confused.
- Progress carries forward: a report records only what changed that day, and the
  position on any date is the latest value on or before it. A missed day never
  resets the site.
- Nav icons are inline SVG rather than Unicode glyphs — characters like `⎙` and `▥`
  are missing from the default iOS font and render as empty boxes.
