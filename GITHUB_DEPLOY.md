# Putting SiteLog on GitHub — step by step

Everything here is done in a web browser. No Git, no command line, no software to
install. Budget about 20 minutes the first time.

At the end you will have:

- a live HTTPS address like `https://hidecor-tech.github.io/sitelog/`
- the app installable on any iPhone or Android straight from that address
- that same address ready to paste into PWABuilder

---

## Before you start — two things to decide

### 1. The repository has to be public (on a free account)

GitHub only publishes Pages sites from **private** repositories on a paid plan
(Pro, Team or Enterprise). On the free plan the repository must be **public**.

For this app that is normally fine, and worth being clear about why:

- The repository holds **only the app's code** — the HTML, CSS, JavaScript and icons.
- It holds **no project data at all**. Every report, photo, BOQ and client name
  lives in IndexedDB on the engineer's phone and is never uploaded anywhere.
- So a public repository exposes the tool, not your projects.

What it does expose is the app itself — anyone could read the code or use the
blank app. If that is not acceptable, the options are GitHub Pro (about $4/month,
lets you keep the repo private) or a different host such as Netlify, which serves
from a private source on the free tier.

> Note either way: **a Pages site is publicly reachable even when the repository is
> private.** Making the repo private hides the source, not the site.

### 2. The repository name decides your URL — and affects Android

| You name the repo | App lives at | Android Play packaging |
|---|---|---|
| `sitelog` | `https://<account>.github.io/sitelog/` | needs an extra step (below) |
| `<account>.github.io` | `https://<account>.github.io/` | works directly |

The reason: packaging for Google Play produces a Trusted Web Activity, which must
verify a file at **`https://<domain>/.well-known/assetlinks.json`** — at the root of
the domain, not inside a sub-folder. A project site such as `/sitelog/` is not the
root, so the file has nowhere to go.

**Recommendations:**

- **Just want it on phones (including iPhone)?** Use `sitelog`. Simple, and Add to
  Home Screen works perfectly. None of this matters.
- **Want it on Google Play?** Either name the repo `<account>.github.io` so the app
  sits at the root, or use a custom domain such as `sitelog.hidecor.in` — see
  "Custom domain" near the end. For a company tool, the custom domain is the
  tidier answer.

---

## Part A — Create the repository and upload the app

**A1.** Go to **github.com** and sign in. If HIDECOR has no account yet, create
one — use a company address, and prefer an organisation account (e.g. `hidecor`)
over a personal one, so the app does not sit under one person's name.

**A2.** Top right, click **+** → **New repository**.

**A3.** Fill it in:

- **Repository name:** `sitelog` (or `<account>.github.io` — see above)
- **Description:** `HIDECOR SiteLog — mobile daily progress report app`
- **Public** selected
- **Leave "Add a README file" unticked.** The zip already has one, and an extra
  file here only gets in the way.

Click **Create repository**.

**A4.** Unzip `HIDECOR_SiteLog_PWA.zip` on your computer. Open the folder.

You should see `index.html`, `manifest.json`, `sw.js` and the folders `css`, `js`,
`icons`, `screenshots`.

> **This next bit is the one step people get wrong.** You upload the **contents**
> of that folder, not the folder itself. GitHub Pages needs `index.html` sitting at
> the very top of the repository. If you drag the folder in, everything lands one
> level too deep and the site shows a 404.

**A5.** On the empty repository page, click **uploading an existing file**.

**A6.** Open the unzipped folder, select **everything inside it** (Ctrl+A on
Windows, Cmd+A on Mac), and drag it all onto the GitHub upload area. The folders
come along with their contents.

Wait for every file to finish — there are about 37 of them, roughly 1.4 MB.

**A7.** In the **Commit changes** box at the bottom type `Initial upload`, then
click **Commit changes**.

**A8.** Check the file list now shows `index.html` directly, not a folder you have
to click into first. If it is nested, delete the files and redo step A6.

**A9 — the hidden file.** The zip contains a file named `.nojekyll`. Files starting
with a dot are hidden by Windows and macOS, so it very likely did not upload.
It stops GitHub running its blog engine over your app. Add it by hand:

1. **Add file** → **Create new file**
2. Name it exactly `.nojekyll` (nothing else, no extension)
3. Leave the body empty
4. **Commit changes**

---

## Part B — Turn on GitHub Pages

**B1.** In the repository, click **Settings** (top row).

**B2.** Left sidebar → **Pages**.

**B3.** Under **Build and deployment**:

- **Source:** `Deploy from a branch`
- **Branch:** `main`, folder `/ (root)`
- Click **Save**

**B4.** Wait one to three minutes, then refresh the page. A green banner appears
with your live address:

```
Your site is live at https://<account>.github.io/sitelog/
```

**B5.** Open that address on your computer. SiteLog should load.

If you get a 404, give it another two minutes — the first build is the slowest.
Still 404 after five minutes, check `index.html` is at the top level (step A8).

---

## Part C — Test it on a phone

**C1.** Open the address on your phone's browser.

**C2.** Install it:

- **Android (Chrome):** a banner offers **Install**. If not: menu ⋮ → **Add to
  Home screen**.
- **iPhone (Safari):** Share button → scroll → **Add to Home Screen**.
  It must be Safari — Chrome on iOS cannot install web apps.

**C3.** Open it from the home screen icon. It should fill the screen with no
browser address bar.

**C4.** **Test it properly — this is the important one.** Turn on flight mode, then:

1. Take a site photo and give it a description
2. Set a few progress percentages
3. Add manpower
4. Press **Share DPR as PDF**

All of it should work with no signal. That is the service worker doing its job,
and it is what the app will be doing on a real site.

**C5.** Turn flight mode off. Nothing needs to sync — there is no server. The data
was always on the phone.

---

## Part D — Package with PWABuilder

Only needed if you want the app in the Play Store. Skipping this loses you nothing
except the store listing; Add to Home Screen gives your engineers the same app.

**D1.** Go to **pwabuilder.com**.

**D2.** Paste your Pages address and press **Start**.

**D3.** It scores Manifest, Service Worker and Security. This build is set up to
pass all three. If the manifest score is short a point or two, it is usually
because GitHub serves `manifest.json` as `application/json` rather than
`application/manifest+json` — harmless, and nothing you can change on Pages.

**D4.** **Package For Stores** → **Android** → **Google Play**.

Suggested values:

| Field | Value |
|---|---|
| Package ID | `in.hidecor.sitelog` |
| App name | `HIDECOR SiteLog` |
| Short name | `SiteLog` |
| App version | `1.0.0` |
| Version code | `1` |
| Signing key | **Create new** |

> **Save the `.keystore` file it gives you, plus its passwords, somewhere you will
> still have them in three years.** Lose that file and you can never publish an
> update to this app — you would have to start a brand new Play listing.

**D5.** The download contains `app-release-bundle.aab` (this goes to Play) and
`assetlinks.json`.

**D6 — the assetlinks step.** `assetlinks.json` must end up at:

```
https://<account>.github.io/.well-known/assetlinks.json
```

Note the domain root — not inside `/sitelog/`.

- If you named the repo `<account>.github.io`, just add a `.well-known` folder to
  that repo with the file in it.
- If you used a project repo like `sitelog`, create a **second** repository named
  `<account>.github.io`, enable Pages on it the same way, and put
  `.well-known/assetlinks.json` there.
- If you set up a custom domain, put it in whichever repo serves that domain.

To create a folder in the GitHub web UI: **Add file** → **Create new file**, then
type `.well-known/assetlinks.json` as the filename — typing the `/` creates the
folder. Paste the file contents in and commit.

Skip this and the app opens with a browser address bar across the top, which is
the single most common complaint about TWA packaging.

**D7.** In Play Console: create the app, upload the `.aab`, and fill the listing
using the images in `screenshots/`. The data-safety form is short for this app —
no data collected, no data shared, since everything stays on the device.

---

## Part E — Updating the app later

**E1.** Edit or replace the files in the repository (upload new ones the same way,
or click a file → pencil icon to edit in place).

**E2. Do not skip this.** Open `sw.js`, find the first line:

```js
const CACHE = "sitelog-v1.0.0";
```

Change the version — `sitelog-v1.0.1`. This is what tells phones that already have
the app to fetch the new files. Without it they keep serving the old cached
version and your change never appears.

**E3.** Commit. Pages rebuilds in a minute or two, and phones pick it up on their
next launch.

Published to Play? You only need a new store upload when the icon, name or package
ID changes. The app's content updates from your site on its own.

---

## Optional — a custom domain (`sitelog.hidecor.in`)

Better for a company tool: it looks right, it survives moving off GitHub, and it
solves the Android assetlinks problem because the app sits at the domain root.

**1.** In the repository: **Settings** → **Pages** → **Custom domain**, enter
`sitelog.hidecor.in`, **Save**. This adds a `CNAME` file to the repo.

**2.** With whoever manages your `hidecor.in` DNS, add one record:

| Type | Name | Value |
|---|---|---|
| CNAME | `sitelog` | `<account>.github.io` |

**3.** Wait for DNS to propagate — usually minutes, sometimes a few hours.

**4.** Back in Settings → Pages, tick **Enforce HTTPS** once it becomes available.
GitHub issues the certificate automatically and free.

**5.** Your app is now at `https://sitelog.hidecor.in/`, and `assetlinks.json` goes
at `https://sitelog.hidecor.in/.well-known/assetlinks.json` in the same repo.

---

## Optional — the command line route

If you or a colleague already use Git:

```bash
cd path/to/unzipped/folder          # the folder containing index.html
git init -b main
git add -A                          # picks up .nojekyll automatically
git commit -m "HIDECOR SiteLog — initial"
git remote add origin https://github.com/<account>/sitelog.git
git push -u origin main
```

Then do Part B. Updates afterwards:

```bash
git add -A && git commit -m "Update" && git push
```

---

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| 404 at the Pages URL | `index.html` is not at the top level — you uploaded the folder instead of its contents. Redo step A6. Or Pages is still building; wait 3 minutes. |
| Page loads but has no styling | The `css` and `js` folders did not upload. Check the repo file list shows both. |
| No install option on Android | The address must be `https://`. Check the service worker registered: Chrome → ⋮ → Developer tools → Application → Service Workers. |
| iPhone shows no "Add to Home Screen" | You are in Chrome or another browser. iOS only allows this from Safari. |
| App does not work offline | Load it once online first so the cache fills. Then test flight mode. |
| Changes don't show on phones | You forgot to bump `CACHE` in `sw.js` — step E2. Or force it: uninstall the app from the home screen and reinstall. |
| Android app has an address bar | `assetlinks.json` is missing from the domain root — step D6. |
| Pages setting says repo must be public | Free plan. Make the repo public, upgrade to Pro, or host on Netlify instead. |

---

## One thing that does not change

However you host it, **the data still lives only on each phone.** GitHub hosts the
app; it does not store a single report or photo. Each engineer's phone holds its
own, and the weekly backup from **More → Backup** is the only way to recover any of
it if a phone is lost or wiped.

If what you actually need is site and office seeing the same reports, that is a
different build with a server behind it — worth deciding before this gets rolled
out to several sites.
