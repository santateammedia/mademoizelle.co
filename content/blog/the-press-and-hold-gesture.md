---
title: "The press-and-hold that became our signature"
description: "How a simple gesture — holding the AI image to reveal the original selfie — became the emotional core of Mademoiselle, after our first prototype's compare slider tested poorly and felt clinical."
excerpt: "The first prototype used a side-by-side compare slider. It tested poorly. Then we tried a press-and-hold to peek at the original — and the room went quiet."
slug: "the-press-and-hold-gesture"
publishedAt: "2026-04-26"
updatedAt: "2026-04-27"
author: "Yara from Mademoiselle"
category: "studio"
tags: ["design", "interaction", "AI"]
coverTone: "warm"
featured: true
faq:
  - q: "Why not keep the side-by-side slider as an option?"
    a: "Because options are an apology. The slider belonged to a clinical mode the brand was never going to live in. We removed it rather than hide it behind a setting."
  - q: "What is the latency budget for the reveal?"
    a: "Under 90 milliseconds from finger-down to original-visible. Beyond that the gesture stops feeling like a peek and starts feeling like a state change."
  - q: "Did you A/B test this against the slider?"
    a: "We did one round of qualitative tests with eight users. The press-and-hold won every single session. Numbers came later — first we trusted the room going quiet."
---

There is a small ritual that happens every time someone tries Mademoiselle for the first time. They generate a hairstyle. They look at the image. And then, almost involuntarily, their thumb presses down. Held for a second. Released. Pressed again.

We did not invent this gesture. iOS has been training fingers to press-and-hold for years. What we did was build a product where the most emotional moment lives behind that gesture — and let people discover it the way you discover a secret.

## The first prototype was honest, and a little ugly

When we started Mademoiselle, the brief from our founder was simple. *Show people the version of themselves they have not yet met.*

The most literal interpretation was a compare slider. A vertical line down the middle of the image. Drag left to see the original. Drag right to see the AI version. We shipped it to a small Riyadh testing group in late 2025, and it was, by every metric, fine.

> Fine is the most dangerous word in product design. It means the thing works. It also means nobody will ever tell their friend about it.

The slider tested fine. The numbers were fine. Nobody complained. Nobody also said anything memorable. We watched recordings of users sliding back and forth like they were inspecting a passport photo. There was no moment.

### What was wrong, exactly

It took us a week to articulate it. The slider was *clinical*. It treated the AI image as a claim that needed verification — *here is the proposition, here is the evidence, drag to compare*. That framing is correct for a medical app. It is wrong for a beauty product.

A beauty product is not a verification flow. It is an invitation. The user is not auditing the AI. The user is meeting a possible self.

> [!note]
> Every interaction in your product carries a metaphor. The slider's metaphor was *court evidence*. We needed *secret garden*.

## The pivot: press-and-hold to peek

A designer on our team — Reem — drew a single sketch on a napkin during lunch. Just a finger pressing down on a phone, with a small label: *peek at the original*.

That afternoon we built it. By Friday we were testing it. By the following Monday we knew.

The gesture works because it changes the *direction of effort*. With the slider, the user had to actively work to compare — drag, release, drag again. The default state was the AI image, and seeing the original required labor.

With press-and-hold, the default is still the AI image. But seeing the original is now *effortless and temporary*. You hold to peek. You release and the AI version reflows back, like water. The gesture becomes a small act of possession. *This new self is the default now. The old one is a memory I can revisit.*

### The latency budget

Anticipation is a real thing in interaction design. There is a number — and you can argue about whether it is 80 milliseconds or 100 — beyond which a gesture stops feeling responsive and starts feeling like a state change. A button click. A page load.

Our budget for the reveal is 90 milliseconds, finger-down to original-pixel-visible. We hit it on the first try because the original image is already in memory — we had it before we had the AI version. There is no network call. There is barely any logic. Just a CSS opacity transition, gated by a `pointerdown` handler.

> [!ai]
> The model that generates the hairstyle is the impressive part. The 90-millisecond reveal is the part people will remember. We accept this.

## What surprised us

Three things, in order of how surprised we were.

**One.** People rediscover the gesture. They press-and-hold once during onboarding. Then, on screen four or five, they do it again — to *check*. As if they need to confirm the AI version is still the same person. The gesture became a kind of grounding ritual.

**Two.** The gesture is shareable in a way the slider never was. People send Mademoiselle screen recordings to their friends, and the recordings *include the press*. You see the AI image, then a brief flash of the original, then the AI image again. It is a tiny piece of theatre. The slider was never theatre.

**Three.** Removing the slider made our settings page shorter. There is no toggle for *enable compare mode*. There is no preference for *default view*. There is one gesture, and it is the same for every user, in every market, on every device. Reducing options is almost always a kindness.

## The rule we wrote afterwards

After the press-and-hold landed, we wrote a one-line design principle that sits at the top of our Figma library now.

> Effort should match emotion. Easy things should feel like nothing. Important things should feel like a held breath.

The press-and-hold is a held breath. The release is the exhale. The product is the moment in between.

That is what we are building.
