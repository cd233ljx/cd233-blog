import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.{md,mdx}',
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(240),
        publishedAt: z.coerce.date(),
        updatedAt: z.coerce.date().optional(),
        tags: z
          .array(z.string().trim().min(1))
          .max(12)
          .default([])
          .transform((tags) => [...new Set(tags)]),
        draft: z.boolean().default(false),
        featured: z.boolean().default(false),
        cover: image().optional(),
        coverAlt: z.string().trim().min(1).optional(),
      })
      .superRefine((post, context) => {
        if (post.cover && !post.coverAlt) {
          context.addIssue({
            code: 'custom',
            path: ['coverAlt'],
            message: '使用封面图片时必须填写 coverAlt。',
          });
        }
      }),
});

export const collections = { posts };
