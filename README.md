# thevincentcheung.com

A simple, zero-dependency gallery of Vincent Cheung's drawings and paintings.

Run `node scripts/serve.mjs` and open the printed local address. The preview
server serves only the public site files, so ignored original photos and
development files are not exposed. Set `PORT` if port 4173 is already in use.

Run the interaction regression tests with `node --test tests/*.test.cjs`.

## What's inside

- A playful gallery with Vincent's profile photo, warm colors, and taped artwork.
- Photo pops with occasional laughs, a tiny web-shooting spider, and a saved
  sound preference behind a small speaker control in the footer.
- Full-size artwork dialogs with previous/next controls, keyboard navigation,
  phone swiping, zoom, sharing, keyboard dismissal, and restored focus.
- Brickball hidden behind the tiny pinball machine in the footer, also reachable with
  `#pinball`. Keyboard/touch controls and device-local best scores are preserved.
- Self-hosted assets, with no accounts, analytics, or external runtime requests.

The page uses one warm cream canvas, white paper frames, and colored tape.
Background texture studies are retained locally in `assets/theme/` but are not loaded
by the page.

To add artwork, put its public image in `assets/art/` and add an `art-piece`
button to the gallery in `index.html`. Include a descriptive image alt text,
actual image dimensions, and full-size source, following the existing pieces.
The responsive grid and close-up view include new entries automatically.

The former space and card scripts/assets remain available in the repository
but their sections are no longer shown on the homepage.

The favicon and phone icon reuse the footer's smiling pinball SVG. Regenerate
them with `node scripts/prepare_icons.mjs` when Sharp is available locally or
through `NODE_PATH`. `scripts/prepare_brand_assets.py` uses the same generator
before creating the social preview; it also requires Pillow. These tools are
only for preparing assets and are not needed by the live site or deployment.

## Publishing

GoDaddy manages the domain and DNS. GitHub Pages hosts the website. This is the
complete hosting setup; no additional proxy or hosting service is configured.

GitHub Pages uses the **GitHub Actions** source in the repository's Pages
settings. `.github/workflows/pages.yml` runs the regression tests and builds
the site on pull requests and pushes to `main`. Publishing only runs on `main`
after both checks succeed, including when a commit is pushed directly. The
workflow uses pinned official actions and gives publishing permissions only
to the deployment job. No package install or deployment secret is needed.

Run `node scripts/build-site.mjs` to create the same `_site/` artifact locally.
The build copies a narrow allowlist of public entry points and assets referenced
by the HTML/CSS, includes the lazy-loaded pinball script and font licenses, and
fails if a referenced file is missing or outside the allowlist. It excludes
originals, mockups, tests, development scripts, unused artwork experiments, and
repository files. Upload or deploy `_site/`, never the whole working folder.

The custom domain is `thevincentcheung.com`, and HTTPS is enforced in Pages
settings. Keep the matching `CNAME` file as a project reference. The `validate`
status check is required for `main`, including for administrators; force pushes
and branch deletion are blocked. Future changes should use a pull request that
passes validation before merging.
Use strong two-factor authentication for both GitHub and GoDaddy. These account
settings remain unverified and require the owner's signed-in access. See
[GoDaddy's two-step verification instructions](https://www.godaddy.com/help/enable-2-step-verification-7502).

See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Security policy

The HTML includes an enforced Content Security Policy restricting scripts,
styles, fonts, images, and audio to this site's origin. It blocks inline scripts
and style attributes, network API connections, objects, base URL changes, and
form submissions. Animations set individual style properties from local scripts.
The referrer policy is `no-referrer`.

The local preview also sends anti-framing and MIME-sniffing response headers.
These local headers do **not** configure GitHub Pages. The deployed GitHub Pages
homepage already redirects HTTP to HTTPS and sends HSTS (verified October 3,
2026). Its repository files cannot configure arbitrary response headers.

GoDaddy DNS settings do not control the HTTP headers sent by GitHub Pages.
Additional anti-framing and MIME-sniffing response headers are outside the
current hosting setup, so they are not a pending deployment step. Keep the
existing GoDaddy and GitHub Pages setup. `frame-ancestors` must be a response
header; adding it to the HTML policy would not block framing.
See the [MDN reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

For detailed game diagnostics during development, add
`data-pinball-debug="true"` to the canvas before loading. Production only exposes
the current game/render state and avoids per-frame diagnostic DOM writes.
