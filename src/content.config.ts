// Colecciones de contenido: las guías (artículos en Markdown en src/content/guias/).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const guias = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/guias' }),
  schema: z.object({
    title: z.string(),
    /** Meta description (≤ 160 caracteres). */
    description: z.string(),
    /** Fecha de publicación y de la última revisión (AAAA-MM-DD). */
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** Orden en el índice de guías (menor = antes). */
    order: z.number().default(100),
    /** Slugs de otras guías relacionadas. */
    related: z.array(z.string()).default([]),
  }),
});

export const collections = { guias };
