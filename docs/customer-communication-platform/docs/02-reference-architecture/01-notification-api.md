---
sidebar_label: Notification front door
---

# Notification front door

The notification front door is where a producer submits a notification and reads its status. It holds three parts: **ingestion**, **outbox**, and **release**. Ingestion accepts the request. The outbox publishes immediate notifications. Release publishes notifications whose send time has arrived. None of the three resolves an address, renders a template, or calls a provider.

Back to the [reference architecture](./index.md). The accept transaction and the status values are in [section 3](./index.md#3-consistency-time-and-state).

## Steps

1. A producer calls ingestion with a tracking id, over REST.
2. Ingestion writes the notification and one outbox row in one transaction. A repeated tracking id returns the original row and does not write a second outbox row.
3. The outbox claims immediate rows with `SKIP LOCKED` and publishes `notification.ready`.
3a. Release claims rows whose send time has arrived, with `SKIP LOCKED`, and publishes the same event.
15. When the notification core brain reports a result, the front door updates the same row. That update is the only way status moves after the commit.

## How to design it

| Part | Build it to | It must not |
|------|-------------|-------------|
| Ingestion | Authenticate the producer, validate the body, and commit the row plus the outbox | Resolve a recipient, render a template, or call a provider |
| Outbox | Claim rows in `RECEIVED` with no future send time, publish, then mark the row published | Select a `SCHEDULED` row |
| Release | Claim rows in `SCHEDULED` whose send time is due, then publish the same event | Run a second path through the notification core brain |
| Status | Read the row for a tracking id the caller owns | Compute status by asking the notification core brain or a provider during the read |
| Idempotency | Treat the tracking id as the key. Store it unique | Generate a second notification when the producer retries a timed-out call |

The claim is `FOR UPDATE SKIP LOCKED` in one statement. A second instance of the outbox, or of release, cannot take the same row. Wait for the Kafka acknowledgement, then mark the row published. A crash before that mark publishes again. The notification core dispatcher ignores a repeated `notification.ready`.

A missing tracking id is generated and returned. A producer that already has one sends it. The send time, when present, is stored in UTC. A send time in the past is accepted as immediate.

The front door is internal. Product systems call it. Customers do not.

## API

### Ingestion

`POST /v1/notifications`

| Field | Required | Meaning |
|-------|----------|---------|
| `trackingId` | No | Producer key. Generated when omitted. Unique |
| `customerId` | Yes | Who to resolve in step 6 |
| `templateId` | Yes | What to render in step 7 |
| `data` | Yes | Values for the template. Not a finished message body |
| `channels` | No | Requested channels. When omitted, recipient resolution's preferences apply |
| `sendAt` | No | Future instant, UTC. Omit for immediate |

Response `202`: `trackingId`, `status` (`RECEIVED` or `SCHEDULED`). A repeat of the same tracking id is `200` with the current status.

### Status

`GET /v1/notifications/{trackingId}`

Response: `status`, `sendAt`, and one entry per channel with that channel's status, provider reference and last error. The channel list is empty until the notification core brain has dispatched.

### Result update

`POST /internal/notifications/{trackingId}/results`

Called by the notification core brain at step 15. Body: channel, status, provider reference, error. The front door applies it to the row in one transaction. Producers cannot call this path.

## Data

| Table | Holds | Writer |
|-------|-------|--------|
| `notification` | Tracking id, producer, customer id, template id, data, channels, send time, status | Ingestion, and the result update |
| `outbox` | Pending publish for this notification | Ingestion inserts. Outbox and release claim |

The outbox row is inserted in the same transaction as `notification`. A status update does not insert another outbox row.

If Kafka is down, the claim returns to pending and ingestion still commits. Status stays `RECEIVED` or `SCHEDULED`. When Kafka returns, the outbox and release drain their rows. The producer does not send the request again.
