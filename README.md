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
- Full-size artwork dialogs with keyboard dismissal and restored focus.
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

The site is ready for GitHub Pages with the included `CNAME` file. Publish the
repository from its root branch, then point the domain's GoDaddy DNS records to
GitHub Pages.

Publish the tracked files, not the entire working folder. Keep the ignored
original photos and local `mockups/` out of uploads. Font licenses are included
in `assets/fonts`.

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
