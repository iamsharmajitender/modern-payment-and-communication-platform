---
sidebar_label: Reference architecture
---

# Large PDF Delivery — Reference Architecture and Solution Design

**Scope:** The cloud-agnostic reference architecture, the services that implement it and the portable technology they run on. Every building block uses open-source or portable technology. [Section 12](#12-cloud-mapping) maps each block to AWS, Azure and Google Cloud managed services. A detailed AWS implementation is in the [AWS deep dive](./03-solution-architecture.md), and the benefits are in the [business use case](./01-business-use-case.md).

---

## Assumptions

The reference architecture rests on the assumptions below. Confirm each one with the business and the owning teams. The last column shows what changes in the design if an assumption turns out to be wrong.

| # | Area | Assumption | If it does not hold |
|---|------|------------|---------------------|
| 1 | Content | The document is the same for every entitled customer. It is not personalised, so all customers share one cached copy at the edge | Personalised documents cannot be shared in the CDN cache. Each version would be rendered per customer, which changes storage, cost and delivery |
| 2 | Document size and count | There are a handful of large documents, each about 1,000 pages and up to roughly 200 MB | Many documents, or search across them, moves search from PostgreSQL to OpenSearch sooner and needs more pipeline capacity |
| 3 | Update frequency | New versions are published monthly or less often, and publishing is not time-critical. Processing a version, including OCR, can take minutes or longer before review | Frequent or urgent updates need a faster pipeline, for example parallel OCR across page ranges |
| 4 | Reading pattern | A customer reads perhaps 20 to 50 pages per session, not the whole document | If most customers read the whole file, range requests save less and the optional offline copy becomes the main path |
| 5 | Customer actions | Customers read, search, bookmark and download. They do not annotate, fill forms or sign | Annotation, forms or signing need a commercial viewer SDK on every platform |
| 6 | Source quality | Source PDFs are valid enough to sanitise and linearise, and most have an outline. Scanned pages are expected and are handled by OCR | Badly structured files are flagged by the pipeline, and publishers must fix the source |
| 7 | Identity and entitlement | Customers sign in through the enterprise identity provider using OpenID Connect, and the rules for who may read each document are available to `document-service` and `access-service` | A missing entitlement source must be built first, because every read path call depends on it |
| 8 | Clients | Customers use existing authenticated apps: a desktop web app that can host PDF.js, and iOS and Android apps that can use PDFKit and `PdfRenderer` | A public website or other client types need their own access and caching rules |
| 9 | CDN capability | The chosen CDN supports HTTP range requests, long cache lifetimes and a cache key that leaves out the access cookie. Which edge token option it supports is confirmed in a spike ([section 4](#4-edge-token-validation-the-portability-question)) | Without range support, desktop falls back to page chunks like mobile. Without edge validation, use the token-checking proxy |
| 10 | Traffic | Read traffic is moderate (the cost illustration uses 10,000 sessions a month), and the CDN absorbs most of it, so origin services stay small | Much higher traffic mainly raises CDN cost. The origin design stays the same, with more replicas |
| 11 | Availability | 99.9% availability is enough, so one region across three availability zones, with a cross-region database replica, meets the target | A higher target needs active-active delivery and storage across regions |
| 12 | Data residency and retention | Storage and processing stay in one required region (for example, Australia). Old versions are kept for as long as regulation requires | Other residency rules change where storage, processing and replicas run. Retention lock is turned on only where required |
| 13 | Publishing roles | At least two administrators are available, so a second person can approve every version before it goes live | A single publisher cannot meet the maker-checker control without a documented exception |

---

## 1. Architecture principles

1. **The API decides who may read. The edge decides how fast.** Clients never talk to the document store directly.
2. **Move only the bytes on screen.** Desktop uses HTTP range requests. Mobile uses small, pre-built page chunks.
3. **Process once, at ingestion.** Text, outline, thumbnails, chunks and the search index are produced when a version is published, not on customers' devices.
4. **Immutable versions.** Each version gets new storage keys. Nothing is overwritten, so caches never need clearing and a reader never mixes versions.
5. **Scan before parse.** Untrusted files are scanned in quarantine before any PDF parser touches them.
6. **Linearise last.** Any later rewrite of the file would undo it.
7. **Portable building blocks.** Kubernetes, PostgreSQL, S3-compatible storage and a standard CDN, so the design runs on any cloud or on premises.

---

## 2. Reference architecture

![Large PDF delivery reference architecture](../diagrams/reference-architecture.png)

Publishing and the ingestion pipeline write immutable versions into the **document data** layer. On the read path, customer apps call the **Document API** for access, metadata, search and reading state, and fetch byte ranges or page chunks through **edge delivery**, which checks an access token before serving from cache. [Open the full diagram](pathname:///large-pdf-render/diagrams/reference-architecture.html).

---

## 3. Service catalogue

### 3.1 Publishing

| Service | Responsibility | Owns data | Interfaces |
|---------|---------------|-----------|------------|
| `admin-portal` | Upload, review, approve and publish versions. Maker-checker approval | None (UI) | Calls `upload-service` and `document-service` admin APIs |
| `upload-service` | Issues pre-signed, resumable multipart uploads straight to the quarantine store. Starts the ingestion workflow when the upload completes | Upload sessions | REST. Publishes `document.uploaded` |

### 3.2 Ingestion

| Service | Responsibility | Portable technology |
|---------|---------------|---------------------|
| `ingestion-orchestrator` | Runs the pipeline as a durable workflow with retries, timeouts and a status per step | Temporal or Argo Workflows |
| `scan-worker` | Malware scan in quarantine. Rejects and alerts on infected files | ClamAV or a commercial scanning engine |
| `pdf-processing-worker` | Validates, sanitises (removes JavaScript, embedded files and launch actions), optimises, linearises, extracts metadata, outline, page labels and per-page text, and builds chunks and thumbnails | Apache PDFBox, qpdf, PDFium |
| `ocr-worker` | Adds an invisible text layer to scanned pages | OCRmyPDF with Tesseract |
| `index-writer` | Writes page text to the search index and version metadata to PostgreSQL. Sets status to "ready for review" | PostgreSQL full-text search, optional OpenSearch |

Workers run in isolated, network-restricted containers because PDF parsers are a common attack surface. They scale on queue depth (for example, with KEDA).

### 3.3 Read path

| Service | Responsibility | Owns data | Interfaces |
|---------|---------------|-----------|------------|
| `document-service` | Lists entitled documents, returns the current version, page count, size, manifest location and checksum | Documents and versions | REST |
| `access-service` | Checks entitlement and issues short-lived edge access cookies scoped to one document version, refreshed while the viewer is open | Signing keys (in the secrets store) | REST |
| `search-service` | Page-level search with snippets and highlight positions | Page text index | REST |
| `reading-state-service` | Last-read page and bookmarks per customer, document and version | Reading state | REST |
| `audit-service` | Records open, search and download events with customer, version, time and channel | Audit events | Consumes events. Exports to the SIEM |

### 3.4 Edge delivery

| Component | Responsibility | Portable options |
|-----------|---------------|------------------|
| CDN | Caches immutable files and serves byte ranges (`206 Partial Content`) and chunks | Any CDN that supports range requests and long cache lifetimes |
| Edge token check | Validates the access cookie before serving from cache | See section 4 |
| Web application firewall | Rate limits per customer, bot control, scraping protection | CDN-integrated WAF or ModSecurity with the OWASP Core Rule Set |

### 3.5 Clients

| Client | Viewer | Notes |
|--------|--------|-------|
| Desktop web | PDF.js in range mode, with streaming and auto-fetch turned off | Uses server search, outline and thumbnails |
| iOS | PDFKit on page chunks | Renders only visible pages |
| Android | `PdfRenderer` on page chunks | Same chunk model |
| Offline (optional) | Full file stored encrypted on the device | Expires with the entitlement |

---

## 4. Edge token validation (the portability question)

The one capability that differs most between CDNs is checking an access token **at the edge, before serving a cached file**. Design for one of three options:

| Option | How it works | When to use |
|--------|-------------|-------------|
| **A. CDN-native signed cookies** | The CDN validates a signed cookie with a policy scoped to `/documents/{docId}/v{n}/*` | Preferred where the CDN supports it |
| **B. Edge function** | A small function at the edge validates a signed JWT cookie, then lets the cached request through | When the CDN has edge compute but no native signed cookies |
| **C. Token-checking proxy** | A thin proxy (Envoy or NGINX) in front of the origin validates the cookie. The CDN forwards the cookie but keeps it out of the cache key | Fallback for any CDN. Adds a hop on cache misses |

In every option the cookie value is **never** part of the cache key, so all entitled customers share one cached copy.

---

## 5. Key flows

### 5.1 Open and read

```mermaid
sequenceDiagram
    participant V as App viewer
    participant API as Document API
    participant E as Edge delivery
    participant S as Object storage

    V->>API: GET /documents/{id} with access token
    API->>API: Check entitlement
    API-->>V: Version, manifest location, edge access cookie
    V->>E: GET document.pdf with Range header (or chunk)
    E->>E: Validate cookie
    E->>S: Fetch range on cache miss
    S-->>E: 206 Partial Content
    E-->>V: 206 Partial Content
    V->>V: Render visible pages
    V->>API: Save reading state (debounced)
    loop While the viewer is open
        V->>API: Refresh edge access cookie
    end
```

### 5.2 Publish a new version

```mermaid
sequenceDiagram
    participant A as Admin portal
    participant U as upload-service
    participant W as ingestion-orchestrator
    participant D as document-service

    A->>U: Start upload
    U-->>A: Pre-signed multipart URLs
    A->>U: Upload complete
    U->>W: Start workflow
    W->>W: Scan, validate, sanitise, OCR, linearise, extract, derivatives
    W->>D: Version ready for review
    A->>D: Second person approves and publishes
    D->>D: Mark version as current
```

---

## 6. Data design

**Object storage layout** (immutable, one prefix per version):

```
/documents/{docId}/v{n}/document.pdf          linearised full file (desktop and download)
/documents/{docId}/v{n}/chunks/001.pdf ...    page chunks (mobile)
/documents/{docId}/v{n}/thumbs/0001.webp ...  page thumbnails
/documents/{docId}/v{n}/manifest.json         page count, chunk map, outline, page labels, checksum
```

**PostgreSQL** (main tables):

| Table | Holds |
|-------|-------|
| `document` | Document ID, title, entitlement rules, current version |
| `document_version` | Version number, status, page count, size, checksum, approver, published time |
| `page_text` | Version, page number, page label, text, full-text search vector |
| `reading_state` | Customer, document, version, last page, bookmarks |
| `audit_event` | Customer, version, action, channel, time (also streamed to the audit store) |

**Events:** `document.uploaded`, `document.version.ready`, `document.version.published`, `document.opened`, `document.downloaded`.

---

## 7. API summary

| Method and path | Purpose |
|-----------------|---------|
| `GET /documents` | Documents the customer is entitled to |
| `GET /documents/{id}` | Current version and manifest. Sets edge access cookies |
| `POST /documents/{id}/access` | Refresh edge access cookies |
| `GET /documents/{id}/versions/{v}/search?q=` | Page-level hits with snippets |
| `GET` and `PUT /me/documents/{id}/reading-state` | Last-read page and bookmarks |
| `POST /documents/{id}/versions/{v}/download` | Short-lived download link, with an audit event |
| `POST /admin/documents/{id}/versions` | Start an upload |
| `POST /admin/documents/{id}/versions/{v}/publish` | Approver publishes a version |

Errors use RFC 9457 problem details. Version numbers are explicit in every URL.

---

## 8. Deployment and resilience

| Concern | Design |
|---------|--------|
| Compute | Kubernetes across three availability zones. API services are stateless and scale on load. Workers scale on queue depth |
| Storage | Object storage with versioning and cross-region replication if required. Retention lock where regulation requires it |
| Database | PostgreSQL high-availability cluster with a cross-region replica |
| Delivery | The CDN absorbs read traffic. The origin is reachable only through the CDN or the token-checking proxy |
| Releases | GitOps with canary releases. A bad document version is rolled back by pointing "current" at the previous version |
| Data residency | Storage and processing stay in the required region (for example, Australia) |

---

## 9. Security

| Control | Design |
|---------|--------|
| Customer authentication | OpenID Connect through Keycloak or the enterprise identity provider |
| Authorisation | Entitlement checked on every metadata, access, search and download call |
| Edge access | Short-lived access cookie scoped to one document version, refreshed while reading |
| Origin protection | Private storage, no public access, reachable only from the edge tier |
| Content safety | Malware scan and sanitising before publish. Viewer scripting turned off |
| Encryption | TLS 1.2 or higher in transit. Encryption at rest with keys in a KMS or HSM |
| Abuse protection | WAF rate limits per customer to slow scraping. Optional viewer watermark |
| Audit | Every open, search and download recorded and exported to the SIEM |

---

## 10. Observability

- Real-user monitoring of time to first page and page-jump time (OpenTelemetry browser and mobile SDKs).
- **Bytes per session** as a key signal: a sudden rise means range loading broke and full downloads are happening.
- CDN cache hit ratio, share of `206` responses and `403` rate (a rising `403` rate means cookie refresh is failing).
- Pipeline duration and failures per step, and any malware detection.

---

## 11. Portable technology stack

| Building block | Portable choice |
|----------------|-----------------|
| Container platform | Kubernetes |
| Workflow engine | Temporal or Argo Workflows |
| Object storage | Any S3-compatible store |
| Database and search | PostgreSQL full-text search, OpenSearch when scale demands |
| Malware scanning | ClamAV or a commercial engine |
| PDF processing | Apache PDFBox, qpdf, PDFium, OCRmyPDF with Tesseract |
| Identity | Keycloak or the enterprise identity provider |
| Secrets and keys | HashiCorp Vault or OpenBao, plus a KMS or HSM |
| Edge proxy (option C) | Envoy or NGINX |
| WAF | ModSecurity with the OWASP Core Rule Set, or the CDN's WAF |
| Observability | OpenTelemetry, Prometheus, Grafana |
| Desktop viewer | PDF.js |
| Mobile viewers | PDFKit (iOS), `PdfRenderer` (Android) |

---

## 12. Cloud mapping

| Building block | AWS | Azure | Google Cloud |
|----------------|-----|-------|--------------|
| Kubernetes | Amazon EKS | Azure Kubernetes Service | Google Kubernetes Engine |
| Object storage | Amazon S3 | Azure Blob Storage | Cloud Storage |
| CDN | Amazon CloudFront | Azure Front Door | Cloud CDN |
| Edge token check | Native signed cookies (option A) | No native signed tokens at the edge, so use option B or C | Native signed cookies (option A) |
| Workflow | Step Functions | Durable Functions | Workflows |
| PostgreSQL | Amazon Aurora PostgreSQL or RDS | Azure Database for PostgreSQL | Cloud SQL or AlloyDB |
| Search at scale | Amazon OpenSearch Service | Azure AI Search | Vertex AI Search or Elastic Cloud |
| Malware scanning | GuardDuty Malware Protection for S3 | Microsoft Defender for Storage | Commercial scanner or ClamAV |
| OCR for hard cases | Amazon Textract | Azure AI Document Intelligence | Document AI |
| Identity | Amazon Cognito | Microsoft Entra External ID | Identity Platform |
| Secrets and keys | AWS Secrets Manager, AWS KMS | Azure Key Vault | Secret Manager, Cloud KMS |
| WAF | AWS WAF | Azure Front Door WAF | Cloud Armor |
| Monitoring | CloudWatch, CloudWatch RUM | Azure Monitor, Application Insights | Cloud Monitoring |

Confirm the edge token option with the chosen CDN in a short spike before committing to it.

---

## 13. Architecture decisions

| # | Decision | Alternative rejected | Reason |
|---|----------|----------------------|--------|
| 1 | Immutable versioned storage keys | Overwrite and clear the cache | No cache invalidation, no mixed-version reads, clear audit |
| 2 | Signed access cookies at the edge | Signed URLs | Long reading sessions outlive URL expiry. Cookies refresh silently |
| 3 | Server-side search | Viewer search | Viewer search downloads the whole document |
| 4 | Page chunks for mobile | Full download or WebView | Native feel and low memory without licence cost |
| 5 | PostgreSQL search first | Search cluster from day one | One database to run, with a clear upgrade path |
| 6 | Portable building blocks with a cloud mapping | Single-cloud native stack | Run on any cloud. The only cloud-specific concern, edge token validation, is isolated in section 4 |
