---
sidebar_label: Notification channel adapters
---

# Notification channel adapters

Notification channel adapters are individual adapters, one per channel: an email adapter, an SMS adapter, a push adapter and a physical-mail adapter. Each consumes its own messages, submits to a [notification external channel provider](./06-external-channel-providers.md), and publishes the result. Adding a channel adds an adapter. It does not add a path through the notification core brain.

Back to the [reference architecture](./index.md).

## Steps

11. The adapter consumes `notification.channel` for its channel.
12. It submits to the notification external channel provider, with the channel message id as the idempotency key.
13. The provider delivers to the customer. Delivery itself is outside the platform. The adapter's job ends at the provider's accept, plus any receipt the provider later sends.
14. The adapter publishes `notification.result`.

A second delivery of the same channel message id does not submit again if the first submit was acknowledged. If the adapter crashes after the provider accepts and before step 14, it submits again with the same idempotency key and then publishes the result.

## Email adapter

Submits the rendered subject and body to the email provider. A result of `SENT` means the provider accepted the message. A later bounce is a further result of `FAILED`. This adapter does not render the template or pick a different address.

## SMS adapter

Submits the rendered body to the SMS provider. A result of `SENT` means the provider accepted the message. It does not fall back to email when SMS is refused.

## Push adapter

Submits the rendered body to the push provider, for the device token. A result of `SENT` means the provider accepted the message. A rejected token is a `FAILED` result. It is not dropped.

## Physical mail adapter

Submits the document reference and the postal address to the print provider. A result of `SENT` means the provider accepted the job. There may be no later delivery receipt. Acceptance is not proof the customer received the letter.

Each adapter scales on the lag of its own consumer group. An email incident does not stop the SMS adapter. Provider credentials are per adapter and come from the secrets manager.

## Result

| Field | Meaning |
|-------|---------|
| `notificationId` | The notification |
| `channelMessageId` | The idempotency key |
| `channel` | `email`, `sms`, `push` or `physical` |
| `status` | `SENT` or `FAILED` |
| `providerReference` | The provider's id, when it returned one |
| `error` | Present when `FAILED` |

The notification core dispatcher consumes this event. The adapter does not call the notification front door. That keeps a single writer path for status: the notification channel adapter publishes the result, and the dispatcher tells the front door.

## Provider receipts

Some providers report delivery or bounce after accept. That report re-enters through the same adapter, which publishes another `notification.result`. The dispatcher applies it if it is newer than the accept. A receipt is not a new submit.
