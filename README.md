# Architecture Notes

Reference architectures and solution designs for three problems, published as a [Docusaurus](https://docusaurus.io/) site.

**Live site:** <https://iamsharmajitender.github.io/modern-payment-and-communication-platform/>

| # | Problem | Status | Read it |
|---|---------|--------|---------|
| 1 | Modern payment platform | Reference architecture and component pages written | [docs/modern-payment-platform](docs/modern-payment-platform/docs/02-reference-architecture/index.md) |
| 2 | Large PDF delivery | Reference architecture and component pages written | [docs/large-pdf-render](docs/large-pdf-render/docs/02-reference-architecture/index.md) |
| 3 | Customer communication platform | Reference architecture and component pages written | [docs/customer-communication-platform](docs/customer-communication-platform/docs/02-reference-architecture/index.md) |

---

## 1. Modern payment platform

**The problem.** An Australian bank (an APRA-authorised deposit-taking institution with an Exchange Settlement Account at the Reserve Bank) is building a greenfield payments platform. It must connect directly to every local rail: NPP with Osko, PayID and PayTo, BECS Direct Entry, BPAY and high-value RTGS settlement through RITS. It must also connect to SWIFT for cross-border payments.

**The approach.** Almost every one of these rails already uses ISO 20022 or is moving to it, so the design centres on one rail-agnostic payments hub with an ISO 20022 canonical model. Channels call a single Payments API. The hub validates the payment, runs shared checks such as payee verification, fraud, sanctions and limits, reserves funds against the ledger and liquidity, then routes the payment to a rail adapter that speaks that scheme's format. Reconciliation, investigations, notifications and regulatory reporting sit after the rails.

**What the documents cover:** an executive brief, the business use case, and a reference architecture. Under the architecture, one page each for clients, the unified payment gateway, the payments hub, the rails, accounts and the ledger, and shared services. Those pages carry the design, the request and response, and the events and files for that part.

## 2. Large PDF delivery

**The problem.** Customers need to open, read, search and download a very large PDF (about 1,000 pages, up to roughly 200 MB) in the desktop and mobile apps. Administrators publish a new version from time to time. Today the whole file downloads before page 1, search runs on the device, and publishing overwrites the file.

**The approach.** A reader views perhaps 20 to 50 pages per session, so the design moves only the bytes for the pages on screen. The Document API decides who may read and issues a short-lived cookie. Edge delivery serves byte ranges to the desktop viewer and pre-built page chunks to the phone. Search, the outline and thumbnails are built once, when the version is published. Each version gets new storage keys. A second person approves it. The pipeline scans for malware before any parser runs, and linearises the file last.

**What the documents cover:** an executive brief, the business use case, and a reference architecture. Under the architecture, one page each for clients, the Document API, edge delivery, publishing, ingestion, and document data. Those pages carry the design, the request and response, and the events and files for that part.

## 3. Customer communication platform

**The problem.** Email, SMS, push and physical mail are separate stacks. Each has its own templates, its own copy of the customer's contact details, and its own status. A product system integrates once per channel, and a future-dated send is a different job from a message that must leave now.

**The approach.** Producers call one Notification front door, over REST, with a tracking id. The accept writes the notification and an outbox row in one database transaction. Inside the front door, the outbox claims immediate rows with `SKIP LOCKED` and puts them on Kafka, and release does the same for rows whose send time has arrived. The notification core brain holds the dispatcher, recipient resolution and template resolution, and writes a channel outbox. Individual adapters for email, SMS, push and physical mail submit to a notification external channel provider and publish the result. The producer reads status from the tracking id.

**What the documents cover:** an executive brief, the business use case, and a reference architecture. Under the architecture, one page each for the notification front door, the notification core brain, the notification channel adapters, the notification external channel providers, and the priority lane design. The front door holds ingestion, outbox and release. The core brain holds the notification core dispatcher, notification recipient resolution and notification template resolution.

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

The site is published at <https://iamsharmajitender.github.io/modern-payment-and-communication-platform/>. You don't need to edit any config for this: the workflow reads the address from GitHub and passes it to the build as `SITE_URL` and `BASE_URL`.

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
