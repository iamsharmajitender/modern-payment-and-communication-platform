---
sidebar_label: Business use case
---

# Large PDF Delivery — Business Use Case

**In one line:** Customers can open, search and read a very large document in the desktop and mobile apps in a couple of seconds, without downloading the whole file, while the business can publish new versions safely and prove who read which version.

**Context:** The organisation publishes a very large PDF (about 1,000 pages, up to roughly 200 MB), such as product terms, a policy wording, a technical manual or a regulatory handbook. Customers need it in the apps, and internal administrators update it from time to time.

---

## 1. The problem today

| Problem | Effect on customers | Effect on the business |
|---------|---------------------|------------------------|
| The whole 200 MB file downloads before page 1 appears | Long waits, especially on mobile data. Many give up | Abandoned sessions and complaints |
| Mobile apps run out of memory on large files | Crashes on lower-end phones | Poor app ratings, support calls |
| Search reads every page on the device | Search is slow or unusable | Customers call the contact centre to find information |
| No reading progress or bookmarks across devices | Customers lose their place | Lower engagement with important content |
| Every session moves the full file across the network | Slow on poor connections | High content-delivery (egress) costs |
| Manual, risky publishing | Customers may see an outdated or broken version | Compliance risk. No proof of which version a customer saw |

---

## 2. Who benefits

| Stakeholder | Benefit |
|-------------|---------|
| **Customers** | First page in about two seconds, instant jumps to any page, fast search, bookmarks that follow them across devices |
| **Contact centre** | Fewer "I can't open it" and "where does it say…" calls |
| **Content publishers** | A simple, safe publishing flow with review and approval, and no file-size headaches |
| **Risk and compliance** | Proof of which version each customer opened and downloaded. Old versions kept as required |
| **Technology and finance** | Much lower delivery cost and fewer app crashes to investigate |
| **Accessibility** | A text layer and accessible viewer so screen-reader users can read and search |

---

## 3. Business use cases

| # | Use case | Customer or user outcome |
|---|----------|--------------------------|
| 1 | **Open and start reading quickly** | The first page appears in about two seconds on desktop and about three on 4G |
| 2 | **Jump to any section or page** | The table of contents and page thumbnails respond instantly, without loading the whole document |
| 3 | **Search the whole document** | Results with page numbers and snippets in under half a second |
| 4 | **Pick up where I left off**, on any device | Last-read page and bookmarks sync between desktop and mobile |
| 5 | **Download for offline reading** (optional) | An encrypted copy that expires when access ends |
| 6 | **Publish a new version safely** | Upload, automatic checks, review and approval by a second person, then go live |
| 7 | **Prove what a customer saw** | Every open, search and download is audited against an exact version |

---

## 4. Benefits

| Area | Benefit | How it is achieved | Measure |
|------|---------|--------------------|---------|
| **Experience** | Fast first page | Only the bytes for the pages on screen are downloaded | Time to first page (95th percentile) |
| **Experience** | Reliable on mobile | Phones load small page chunks instead of the full file | Out-of-memory crash rate |
| **Experience** | Find information quickly | Search runs on the server against a pre-built index | Search response time. Search success rate |
| **Cost** | Far lower delivery cost | About 6 to 10 MB per session instead of 200 MB | Data delivered per session. Monthly delivery cost |
| **Cost** | Fewer support calls | Documents open and search reliably | Calls and complaints about the document |
| **Risk** | Safe content | Every upload is scanned for malware and cleaned of active content before publishing | Zero unsafe files published |
| **Compliance** | Evidence and retention | Immutable versions and a full audit trail | Audit requests answered from records |
| **Inclusion** | Accessible to everyone | A text layer (including OCR for scanned pages) and an accessible viewer | WCAG 2.2 AA conformance |
| **Agility** | Faster updates | Automated processing and approval | Time from upload to live |

**Cost illustration** (from the [AWS deep dive](./03-solution-architecture.md#15-cost-indication), illustrative only): for a 200 MB document and 10,000 sessions a month, delivering the full file costs about **US$200 a month** in delivery charges, against about **US$10 a month** when only the pages being read are delivered.

---

## 5. Measures of success

Proposed targets, to be confirmed with the business.

| Measure | Target |
|---------|--------|
| Time to first page | 95th percentile under 2 seconds on desktop broadband, under 3 seconds on 4G |
| Jump to any page | 95th percentile under 1.5 seconds |
| Search response | 95th percentile under 500 ms |
| Data downloaded per session | Under 10% of the file size |
| Mobile stability | No out-of-memory crashes on a reference low-end Android device |
| Availability | 99.9% for the document service and delivery path |
| Accessibility | WCAG 2.2 AA in the viewer |

---

## 6. Cost of not acting

- Customers keep abandoning the document or calling for help, and app ratings suffer.
- Delivery costs grow with every new reader and every new version.
- Without version control and audit, the organisation cannot prove what a customer was shown.
- Unscanned uploads remain a security risk for customers' devices.

---

## 7. Phased value delivery

| Phase | What goes live | Value released |
|-------|---------------|----------------|
| **1. Desktop** | Ingestion pipeline, document store, edge delivery with access control, Document API, desktop viewer, server search, reading progress | Fast reading and search for desktop customers. Most of the delivery-cost saving |
| **2. Mobile** | Page chunks, iOS and Android viewers, continuous scrolling across chunks | Reliable mobile reading without crashes |
| **3. Hardening and extras** | OCR for scanned pages, optional offline copy, version upgrades that keep bookmarks, dashboards and alerts, load testing | Full accessibility, offline reading, operational confidence |

---

## 8. Risks and how they are managed

| Risk | Mitigation |
|------|------------|
| The document turns out to be personalised per customer | Confirm early. Personalisation stops shared caching and changes the design |
| Annotation, form-filling or signing becomes a requirement | Would need a commercial viewer SDK. Confirm scope before build |
| Poorly structured source PDFs (huge images, no outline) | The pipeline flags them so publishers can fix the source |
| The chosen content delivery network cannot check access tokens at the edge | Use the token-checking proxy option in the reference architecture |

---

## Related pages

- [Reference architecture and solution design](./02-reference-architecture.md): the cloud-agnostic services and technology.
- [AWS deep dive](./03-solution-architecture.md): a detailed AWS implementation, including viewer settings and cost.
