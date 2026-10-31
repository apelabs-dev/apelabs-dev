---
# Template, never published (draft: true). Copy it to <slug>.md for a new post.
title: Post template
description: Copy this file to start a post. Drafts are not built.
pubDate: 2026-10-30
draft: true
---

Rules from the SEO plan: no invented client stories, label any sample as a sample, the author is
the organization (apeLabs), no individual names. Title at most 60 characters, description at most 155.

When the first real post is published, remove the `noindex` logic in `src/pages/blog/index.astro`
if you want it explicit, and take `/blog/` out of `NOT_IN_SITEMAP` in `astro.config.mjs`.
