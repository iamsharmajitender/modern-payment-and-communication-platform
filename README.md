# Architecture Notes

Reference architectures and solution designs for three problems, published as a [Docusaurus](https://docusaurus.io/) site.

| # | Problem | Status | Read it |
|---|---------|--------|---------|
| 1 | Modern payment platform | Component deep dive written | [docs/modern-payment-platform](docs/modern-payment-platform/docs/01-component-deep-dive.md) |
| 2 | Large PDF delivery | Solution architecture written | [docs/large-pdf-render](docs/large-pdf-render/docs/01-solution-architecture.md) |
| 3 | Customer communication platform | In progress | [docs/customer-communication-platform](docs/customer-communication-platform) |

---

## 1. Modern payment platform

**The problem.** An Australian bank (an APRA-authorised deposit-taking institution with an Exchange Settlement Account at the Reserve Bank) is building a greenfield payments platform. It must connect directly to every local rail: NPP with Osko, PayID and PayTo, BECS Direct Entry, BPAY and high-value RTGS settlement through RITS. It must also connect to SWIFT for cross-border payments.

**The approach.** Almost every one of these rails already uses ISO 20022 or is moving to it, so the design centres on one rail-agnostic payments hub with an ISO 20022 canonical model. Channels call a single Payments API. The hub validates the payment, runs shared checks such as payee verification, fraud, sanctions and limits, reserves funds against the ledger and liquidity, then routes the payment to a rail adapter that speaks that scheme's format. Reconciliation, investigations, notifications and regulatory reporting sit after the rails.

**What the document covers:** the rails and their message formats, an eight-layer architecture with a diagram, each layer in detail, end-to-end payment flows, key decisions and trade-offs, the regulatory landscape, the business case and a glossary. It is written as source material for a business deck and a technical deck.

## 2. Large PDF delivery

**The problem.** Customers need to open, read, search and download a very large PDF (about 1,000 pages, up to roughly 200 MB) in desktop and mobile apps. Administrators publish new versions from time to time.

**The approach.** A reader views perhaps 20 to 50 pages per session, so the design moves only the bytes for the pages on screen:

- The PDF sits in private, versioned S3 storage and is served through CloudFront using HTTP range requests and signed cookies.
- The desktop viewer is PDF.js in range mode.
- Mobile apps render server-produced page chunks natively, because iOS PDFKit and Android `PdfRenderer` cannot stream a remote file.
- Search, the table of contents and thumbnails are built at ingestion and served by the API, so the client never needs the whole file.
- Uploads pass through a quarantine bucket and malware scan, then OCR, with linearisation as the last step.

**What the document covers:** requirements and targets, a review of the first draft design, the target architecture on AWS (with Azure and Google Cloud equivalents), the processing pipeline, viewers, search, security, versioning, an API sketch, observability, cost, risks and a delivery plan.

## 3. Customer communication platform

Not written yet. Pages go in [`docs/customer-communication-platform/`](docs/customer-communication-platform). The site adds it to the sidebar as soon as that folder contains a Markdown page.

---

## Run the site locally

You need Node.js 20 or later.

```bash
cd website
npm install
npm start
```

This starts a dev server at <http://localhost:3000> that reloads when you edit anything under `docs/`.

To check the production build:

```bash
npm run build    # writes the static site to website/build
npm run serve    # serves that build at http://localhost:3000
```

## Deploy to GitHub Pages

The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and publishes it on every push to `main`. You can also run it by hand from the **Actions** tab.

One-time setup:

1. Create a repository on GitHub and push this project to its `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`, or run the **Deploy to GitHub Pages** workflow by hand.

The site appears at `https://<your-username>.github.io/<repository-name>/`. You don't need to edit any config for this: the workflow reads the address from GitHub and passes it to the build as `SITE_URL` and `BASE_URL`.

To preview that path locally before pushing:

```bash
cd website
BASE_URL=/<repository-name>/ npm run build
BASE_URL=/<repository-name>/ npm run serve
```

To use a custom domain, set it under **Settings → Pages → Custom domain**. The workflow then builds with the base path `/`.

---

## Repository layout

```
.
├── docs/                                  # All content, one folder per problem
│   ├── modern-payment-platform/
│   │   ├── _category_.json                #   Sidebar label and order
│   │   ├── docs/                          #   Markdown pages
│   │   └── diagrams/                      #   PNG and standalone HTML diagrams
│   ├── large-pdf-render/
│   └── customer-communication-platform/
├── website/                               # Docusaurus site that publishes docs/
│   ├── docusaurus.config.ts
│   ├── sidebars.ts                        #   Builds the sidebar from docs/ folders
│   └── src/pages/index.tsx                #   Home page cards
└── .github/workflows/deploy.yml           # GitHub Pages deployment
```

## Adding or editing content

- Each folder under `docs/` is one problem and becomes a sidebar section. Put its pages in `docs/<topic>/docs/`.
- Set the section label and order in `docs/<topic>/_category_.json`, for example `{"label": "Modern payment platform", "position": 1}`.
- Mermaid code blocks render as diagrams. Images next to a page work with normal relative Markdown links.
- Link to standalone files such as HTML diagrams with `pathname:///<topic>/path/to/file.html`. The build adds the GitHub Pages base path for you.
- Add a home page card for a new topic in `website/src/pages/index.tsx`.

More detail is in [`website/README.md`](website/README.md).
