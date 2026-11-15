---
sidebar_label: Notification core brain
---

# Notification core brain

The notification core brain turns `notification.ready` into one channel message per channel, then applies the result. It has three parts: the **notification core dispatcher**, **notification recipient resolution**, and **notification template resolution**. Recipient resolution and template resolution live here. They are not a separate product, and producers do not call them.

The dispatcher has its own database and its own outbox, so a channel dispatch commits even if Kafka is briefly down. It never writes the front door database except by calling the [notification front door](./01-notification-api.md).

Back to the [reference architecture](./index.md).

## Steps

5. The notification core dispatcher consumes `notification.ready`. A second delivery of the same notification id is ignored once the dispatch row exists.
6. Notification recipient resolution returns the addresses that may be used, and the channels that are suppressed or missing.
7. Notification template resolution renders the content for each remaining channel and returns the template version.
8. The dispatcher writes the dispatch row and one channel outbox row per channel, in one transaction.
9. The dispatcher claims those rows with `SKIP LOCKED`.
10. The dispatcher publishes `notification.channel`.
15. The dispatcher consumes `notification.result`, records the channel outcome, and calls the notification front door so the source-of-truth status moves. It does not submit to a provider from this step.

A scheduled event (step 4a) uses steps 5 onward unchanged. If recipient resolution returns no usable address, the dispatcher fails the notification and does not render. If template resolution fails for one channel, that channel fails. Another channel that rendered is still dispatched.

## How to design it

| Part | Build it to | It must not |
|------|-------------|-------------|
| Notification core dispatcher | Create one dispatch row per notification id, write the channel outbox, publish, and apply results | Render in the producer, trust an address on the request, or call a provider |
| Notification recipient resolution | Return allowed contacts, and the channels it refused, with a reason | Accept a notification, store a template, or call a provider |
| Notification template resolution | Return the rendered subject and body, plus the template version | Choose the recipient, or send the message |
| Channel outbox | One row per channel, claimed with `SKIP LOCKED` | Publish to Kafka inside the same transaction as the row, without an outbox |
| Failure | Retry resolution. After the retry budget, mark the notification failed and call the front door | Leave the producer on `RECEIVED` after a permanent failure |

Partial success is normal. Two channels mean two outbox rows. One can be `SENT` while the other is still retrying. The front door is told `IN_PROGRESS` until every channel has a terminal result, then `SENT` or `FAILED`.

## Notification core dispatcher

The dispatcher is the only part of the core brain that reads Kafka and the only part that calls the other two. It consumes `notification.ready`, asks notification recipient resolution, then notification template resolution, and writes the channel outbox. It publishes `notification.channel`, consumes `notification.result`, and calls the notification front door with the new status. It does not choose an address, render content, or call a provider.

## Notification recipient resolution

Request: `customerId`, requested `channels`.

Response: a list of `{channel, destination}` for addresses that may be used, and a list of `{channel, reason}` for channels that were refused (`suppressed`, `missing`, `not-requested`). The destination is an email address, a phone number or a device token. It is not returned to the producer. It travels only as far as the notification channel adapter.

Recipient resolution is the customer master for contact. This platform does not keep a second copy to send from. A stale extract in a producer is not an input. The request's `customerId` is. It owns addresses, device tokens, preferences and suppression.

## Notification template resolution

Request: `templateId`, `channel`, `locale`, `data`.

Response: `templateVersion`, and the channel payload. Email has a subject and a body. SMS and push have a body. The part refuses an unknown template or a channel the template does not support. It does not interpolate from an unapproved template id.

`data` is the producer's values. The template defines which values are required. A missing required value is a failed render, not a blank message. Templates are approved before a producer can name them. The version on the response is what the dispatcher stores, so a later edit does not rewrite history.

## Data

| Table | Holds |
|-------|-------|
| `dispatch` | Notification id, tracking id, template version, resolve outcome |
| `channel_message` | Channel message id, channel, destination, status, provider reference |
| `outbox` | Pending `notification.channel` publishes |

`channel_message.id` is the idempotency key the adapter sends to the provider. Recipient contacts and approved templates stay in their own stores, read through the two resolution parts. They are not copied into the front door database.

## Status call

`POST /internal/notifications/{trackingId}/results` on the [notification front door](./01-notification-api.md). The dispatcher retries that call until the front door accepts it. A retry does not create a channel message.
