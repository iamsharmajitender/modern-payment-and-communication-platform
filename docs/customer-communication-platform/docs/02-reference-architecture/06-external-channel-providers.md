---
sidebar_label: Notification external channel providers
---

# Notification external channel providers

Notification external channel providers are the bought services that accept a message and deliver it: email, SMS, push and print. A [notification channel adapter](./05-channels.md) is the only caller. The provider does not see the producer, the notification front door, or the notification core brain.

Back to the [reference architecture](./index.md).

## What each provider does

| Provider | Accepts | Deliver means | Receipt |
|----------|---------|---------------|---------|
| Email | A rendered subject and body, to one address | The provider accepted the message for delivery | A later bounce can return `FAILED` |
| SMS | A rendered body, to one phone number | The provider accepted the message | A later delivery report can update the result |
| Push | A rendered body, to one device token | The provider accepted the message | A token rejection is a `FAILED` result |
| Print | A document reference and a postal address | The provider accepted the print job | There may be no later receipt. Status then stops at accepted |

The adapter sends the channel message id as the idempotency key. A repeated submit with the same key is the same send. The provider's own reference, when it returns one, is stored on the result. It is not a second tracking id for the producer.

Delivery to the customer is the provider's work. This platform's job ends at accept, plus any receipt the provider later returns through the same adapter. A receipt is not a new submit.

## How to design the boundary

| Rule | What it means |
|------|----------------|
| Replaceable | Swapping an email provider changes that adapter's client. It does not change the dispatcher, the front door, or the other adapters |
| Credentials | Each provider's credentials live in the secrets manager for that adapter |
| No fan-out | A provider is not asked to try another channel when its channel fails |
| No content choice | The provider receives the rendered payload. It does not look up the customer or the template |
