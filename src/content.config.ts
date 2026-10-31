// Blog posts: Markdown files in src/content/blog/. At launch it holds only post-template.md
// (a draft, never built), so /blog/ is noindex; the first real post also needs /blog/ taken
// out of the sitemap exclusion in astro.config.mjs.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().max(60),
    description: z.string().max(155),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
