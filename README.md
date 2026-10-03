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

## Publishing

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

Keep `CNAME` set to `thevincentcheung.com` and HTTPS enforced in Pages settings.
Require the `validate` status check for `main` to protect pull-request merges.
Use strong two-factor authentication for both GitHub and the domain registrar;
these account settings must be verified separately from repository checks.

See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Security policy

The HTML includes an enforced Content Security Policy restricting scripts,
styles, fonts, images, and audio to this site's origin. It blocks inline scripts
and style attributes, network API connections, objects, base URL changes, and
form submissions. Animations set individual style properties from local scripts.
The referrer policy is `no-referrer`.

The local preview also sends anti-framing and MIME-sniffing response headers.
These local headers do **not** configure GitHub Pages. The deployed GitHub Pages
homepage already redirects HTTP to HTTPS and sends HSTS (verified September 12,
2026). Its repository files cannot configure arbitrary response headers.

If a response-header-capable host or edge proxy is configured later, add:

```text
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

The header CSP combines with the existing HTML policy. `frame-ancestors` must
be a response header; adding it to the HTML policy would not block framing.
See the [MDN reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

For detailed game diagnostics during development, add
`data-pinball-debug="true"` to the canvas before loading. Production only exposes
the current game/render state and avoids per-frame diagnostic DOM writes.
