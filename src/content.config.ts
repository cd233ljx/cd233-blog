import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: ['*.{md,mdx}', '*/articles/*.{md,mdx}'],
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(240),
        publishedAt: z.coerce.date(),
        updatedAt: z.coerce.date().optional(),
        slug: z
          .string()
          .regex(/^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u)
          .optional(),
        series: reference('series').optional(),
        order: z.number().int().min(0).optional(),
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
        if (Boolean(post.series) !== (post.order !== undefined)) {
          context.addIssue({
            code: 'custom',
            path: ['order'],
            message: '系列文章必须同时填写 series 和非负整数 order。',
          });
        }
        if (post.cover && !post.coverAlt) {
          context.addIssue({
            code: 'custom',
            path: ['coverAlt'],
            message: '使用封面图片时必须填写 coverAlt。',
          });
        }
      }),
});

const series = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '*/series.json',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(240),
  }),
});

export const collections = { posts, series };
