# hub-cms-demo

A Jekyll site published via GitHub Pages, edited through Decap CMS, with OAuth handled by a Cloudflare Worker.

## URLs

| What | Where |
| --- | --- |
| Live site | https://fcuesta-ib.github.io/hub-cms-demo/ |
| CMS admin | https://fcuesta-ib.github.io/hub-cms-demo/admin/ |
| OAuth worker | https://decap-oauth.fcuesta-ib.workers.dev |
| Source repo | https://github.com/fcuesta-ib/hub-cms-demo |

## Accounts

| Service | Purpose | Login |
| --- | --- | --- |
| GitHub (`fcuesta-ib`) | Source hosting, Pages, OAuth app | github.com |
| Cloudflare (`fcuestaib@gmail.com`) | Worker hosting | dash.cloudflare.com |

The **GitHub OAuth App** is registered at https://github.com/settings/developers under the GitHub account. Its callback URL must be `https://decap-oauth.fcuesta-ib.workers.dev/callback`.

## Repo layout

```
.
├── .github/workflows/jekyll.yml   # Builds + deploys Jekyll to Pages on push to main
├── _config.yml                    # Jekyll config (baseurl: /hub-cms-demo)
├── _layouts/default.html          # Shared HTML shell + nav
├── _pages/                        # Subpages (about, contact, …)
├── admin/                         # Decap CMS shell + config
│   ├── index.html
│   └── config.yml
├── assets/style.css
├── index.md                       # Home page
└── worker/                        # Cloudflare Worker — separate deploy
    ├── wrangler.toml
    └── src/index.js
```

The `worker/` directory is excluded from Jekyll's build.

## Prerequisites

- **Ruby + Bundler** — only needed to preview Jekyll locally. Skippable; GitHub Actions builds remotely on every push.
- **Node.js + npm** — only needed to deploy worker changes (`brew install node`).
- **Wrangler** — Cloudflare's CLI (`npm install -g wrangler`). Authenticate once with `wrangler login`.

## Editing content

The normal path: open the **CMS admin** URL, log in with GitHub, edit Home or add a page under Pages, click *Publish*. Decap commits to `main`, which triggers the Pages Action and the site redeploys within ~1 minute.

For non-content changes (layouts, styles, nav, plugins), edit files locally and `git push` to `main`.

### Adding a new page

Either:

- **Via CMS** — Pages → *New Pages* → fill in title + body → Publish.
- **Manually** — create `_pages/<slug>.md`:

  ```markdown
  ---
  title: My new page
  ---

  Body content.
  ```

  Its URL will be `/hub-cms-demo/<slug>/`. To put it in the top nav, add a link in `_layouts/default.html`.

## Running Jekyll locally

Optional — only if you want previews before pushing.

```bash
# one-time
brew install ruby
gem install bundler
bundle install

# every time
bundle exec jekyll serve
# then open http://127.0.0.1:4000/hub-cms-demo/
```

The CMS admin will **not** work locally against this server (auth is configured for the production site).

## Deploying the Jekyll site

Push to `main`. That's it.

```bash
git add .
git commit -m "…"
git push
```

The workflow in `.github/workflows/jekyll.yml` runs on each push: it sets up Ruby, runs `jekyll build`, and uploads the result to GitHub Pages. Build status is visible at https://github.com/fcuesta-ib/hub-cms-demo/actions.

GitHub Pages must be set to *Source: GitHub Actions* in repo Settings → Pages (one-time).

## Deploying the Cloudflare Worker

Only needed when `worker/src/index.js` or `worker/wrangler.toml` changes.

```bash
cd worker
wrangler deploy
```

### Worker secrets

The Worker reads two secrets at runtime:

- `GITHUB_CLIENT_ID` — from the GitHub OAuth App
- `GITHUB_CLIENT_SECRET` — from the GitHub OAuth App (generated on creation, shown once)

Set or rotate them with:

```bash
cd worker
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

List current secrets (names only, values are not retrievable):

```bash
wrangler secret list
```

If you ever leak `GITHUB_CLIENT_SECRET`: regenerate it in the GitHub OAuth App settings, then re-run `wrangler secret put GITHUB_CLIENT_SECRET` with the new value. All currently issued user tokens stay valid; existing CMS sessions keep working.

## Wiring summary

```
Browser ───▶ /admin/ (GitHub Pages)
              │
              │ user clicks "Login with GitHub"
              ▼
        Popup opens at decap-oauth.fcuesta-ib.workers.dev/auth
              │
              │ 302 redirect
              ▼
        github.com/login/oauth/authorize ── user approves
              │
              │ 302 with ?code=…
              ▼
        decap-oauth.fcuesta-ib.workers.dev/callback
              │
              │ exchanges code for token using client_id + client_secret
              ▼
        Popup returns HTML that postMessages the token back to /admin/
              │
              ▼
        Decap CMS loads with the token; commits go to GitHub via the API
```

## Troubleshooting

- **CMS shows "Login with GitHub" but clicking it goes to `api.netlify.com/auth`** — `admin/config.yml` either isn't deployed or has `base_url` commented out. Verify with `curl https://fcuesta-ib.github.io/hub-cms-demo/admin/config.yml`.
- **Popup sits on "Authenticating… you can close this window."** — the worker's postMessage handshake is broken. See `worker/src/index.js`: the popup must send `authorizing:github` first, then post the success message to the message's origin. Sending the success message immediately doesn't work with Decap CMS 3.x.
- **`OAuth error: bad_verification_code`** — `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` mismatch with the GitHub OAuth App. Re-run `wrangler secret put` for both.
- **Pages build fails with "Get Pages site failed"** — Pages isn't enabled. Repo Settings → Pages → Source = GitHub Actions.
- **Worker 404 at `/auth`** — worker didn't deploy. Re-run `wrangler deploy` from `worker/`; verify with `curl -I https://decap-oauth.fcuesta-ib.workers.dev/auth` (expect 302 to github.com).
