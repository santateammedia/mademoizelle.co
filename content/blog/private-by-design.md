---
title: "Private by design — why your closet is yours alone"
description: "Concrete commitments behind the Mademoiselle Smart Closet — encryption at rest, no model training on user photos, real deletion (not soft delete), and zero third-party trackers in the studio flow."
excerpt: "We treat your closet like your bedroom drawer — locked, ours never to look in, and yours to empty completely on the day you decide to leave."
slug: "private-by-design"
publishedAt: "2026-04-18"
author: "Ramy from Mademoiselle"
category: "privacy"
tags: ["privacy", "security", "principles"]
coverTone: "dusk"
faq:
  - q: "Do you train your AI models on my photos?"
    a: "No. None of your selfies, closet items, or generated try-ons are ever used to train a model. The image generation runs on per-session inputs that are discarded after the render is complete and the cached result has expired."
  - q: "What does delete actually do?"
    a: "It cascades. When you delete a photo, the original file, every derived render, every cache key, every database row referencing it, and every backup snapshot older than 30 days are all removed. We do not soft-delete and we do not archive. The day you ask, the data is gone."
  - q: "Are there third-party trackers on the site?"
    a: "Not in the studio flow, where photos and renders live. The marketing pages may include first-party analytics. The studio itself runs without any third-party scripts, advertising pixels, or session-replay tools."
---

Privacy is one of those words that has been worn smooth by overuse. Every app has a privacy policy. Every privacy policy says we care. Most of them mean *we care, until caring is inconvenient*.

This essay is not a privacy policy. It is a list of the choices we made *before* we needed to write one — the choices that shape what the Mademoiselle Smart Closet is, what it can do, and what it cannot do, even by accident.

## The frame: the closet is a private surface

Mademoiselle has three core surfaces. The Studio is the AI hairstyle and look try-on flow. The Salon Booking is a marketplace touchpoint. The Closet is the personal record of a user's wardrobe and looks they liked.

The first two are public-adjacent. People share renders. People review salons. The third — the Closet — is not. The Closet is an intimate object, like a bedroom drawer or a jewellery box. The fact that it lives on a server does not change its nature.

> A closet is not a marketing channel. We treat it the way we treat the contents of a bedside table — ours never to look in, ours to keep safe, yours to empty completely on the day you decide to leave.

That sentence is the frame for everything that follows.

## Encryption at rest

Every closet item — photo of a top, render of an outfit, note attached to a piece — is encrypted at rest in our object storage. The keys are scoped per user, rotated on a schedule, and managed in a key-management system that our application servers cannot directly read from.

What this means in practice: a stolen disk, a misconfigured bucket, an angry intern with a database password — none of those vectors leak photos. The photos are unreadable without the key, and the key is held somewhere the database cannot reach.

> [!note]
> Encryption at rest is necessary but not sufficient. The bigger risk in most consumer apps is data leaving the encrypted store and being processed *in the clear* by a logging or analytics pipeline. We address that below.

## No model training on user photos

This is the commitment that surprises people most, because so many products quietly do the opposite.

Mademoiselle does not use your selfies, closet uploads, or generated renders to train its AI models. Not in aggregate. Not de-identified. Not for fine-tuning. Not for evaluation sets. The data path is one-directional: your inputs go into a render, the render returns to you, and the working copies are discarded when the cache expires.

Why this matters: once a photo is in a training set, it is, in some abstract but real sense, *part of the model*. You cannot retract it later. You cannot ask the model to forget. The only way to keep that door closed is to never open it. We never opened it.

The cost of this choice is real. Our models improve more slowly than they would if we mined user data. We accept the trade. We would rather build a slower-improving product that we can stand behind than a faster-improving product whose foundation is a quiet borrowing.

## Real deletion is a cascade, not a flag

Most apps soft-delete. They flag a row as `deleted = true` and leave the data in place — often forever, sometimes indefinitely, frequently across backups that no human at the company can fully account for.

We made an architectural choice early: when you delete in Mademoiselle, the deletion *cascades*. The original photo file is removed from object storage. Every derived render — the AI versions, the thumbnails, the share-card crops — is removed from its respective bucket. Every database row that references the photo is removed by foreign-key cascade. Every cache entry, every CDN edge cache, is invalidated. Backup snapshots older than 30 days are pruned on a rolling window.

> [!ai]
> If a feature would prevent us from cascading a delete cleanly, we do not ship the feature. The right of erasure is not a setting. It is a property of the architecture.

The result is that *delete* in Mademoiselle means what the word means in English. Not *hide*. Not *archive*. *Gone*.

## No third-party trackers in the studio flow

The Studio — where you upload a photo, generate a render, see your face on a new look — is the most sensitive surface we have. It is also the surface most likely, in a less considered version of this product, to be loaded with marketing pixels, A/B testing scripts, session-replay tools, and analytics SDKs.

We made the call to keep all of those out. The Studio runs on first-party code only. There is no Meta Pixel watching you try a new fringe. There is no session-replay tool recording your hesitations. There is no advertising network correlating your render to a campaign ID.

The marketing pages — the homepage, the journal you are reading now, the salon directory — are different. Those may carry lightweight first-party analytics so we know how many people visited. They never carry session-replay or advertising trackers. The Studio is a sealed room.

## The principles, plainly

Here is the list, pulled out of the prose, in case you want to share it.

- *We do not train models on your photos.* Ever, anywhere, in any form.
- *We encrypt closet contents at rest*, with keys scoped per user.
- *We treat delete as a cascade*, not a soft-delete flag.
- *We keep third-party scripts out of the studio*, full stop.
- *We log without leaking* — request logs do not contain photo bytes, render outputs, or user-identifying content beyond what is required for debugging, and those logs are aged out within 14 days.
- *We never sell data*, because we do not have data to sell. The closet is yours.

> A product is the sum of its constraints. The constraints listed here are not the price of doing business — they are the business.

## What we ask in return

We ask that you tell us when something feels off. Privacy is not a static property. The list above is a snapshot of decisions made up to today's date. As we add features, we will need to renegotiate trade-offs. The principles above are the floor. We will be transparent about anything that risks the floor before it ships, not after.

The closet is yours alone. We are the people who built it. We are not the people who get to look inside.
