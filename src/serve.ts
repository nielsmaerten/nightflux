import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { z } from 'zod';
import collectExport from './collect.js';
import logger from './utils/logger.js';
import { resolveRange, resolveTimezone } from './utils/range.js';
import { NightfluxReportSchema } from './domain/schema.js';
import { stringify as yamlStringify } from 'yaml';
import { includeCustomInstructions } from './utils/custom-instructions.js';

const RequestSchema = z
  .object({
    url: z.url(),
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected YYYY-MM-DD')
      .optional(),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Expected YYYY-MM-DD')
      .optional(),
    days: z.number().int().positive().optional(),
    yaml: z.boolean().optional(),
    customInstructions: z.boolean().optional().default(true),
  })
  .strict();

export async function startServer(
  host = process.env.HOST ?? '0.0.0.0',
  port = Number(process.env.PORT ?? 3000),
) {
  // Keep CLI progress quiet in server mode to avoid noisy stderr
  logger.setQuiet(true);

  const app = Fastify({ logger: false, trustProxy: true, bodyLimit: 1024 * 1024 });

  app.get('/health', async () => ({ ok: true }));

  // Static UI: serve index.html at '/'
  let _dirname = path.dirname(new URL(import.meta.url).pathname);
  await app.register(fastifyStatic, {
    root: path.join(_dirname, './public'),
    index: ['index.html'],
    prefix: '/',
    decorateReply: true,
  });
  app.get('/', async (_request, reply) => reply.sendFile('index.html'));

  // Expose JSON Schema for the Nightflux report
  const schemaJson = z.toJSONSchema(NightfluxReportSchema);
  app.get('/schema/v1', async (_request, reply) => reply.code(200).send(schemaJson));
  app.get('/schema/v2', async (_request, reply) => reply.code(200).send(schemaJson));

  // Versioned collect endpoint
  app.post('/collect/v1', async (request, reply) => {
    const parsed = RequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.issues });
    }
    const { url, start, end, days, yaml, customInstructions } = parsed.data;
    try {
      const tz = await resolveTimezone(url);
      const range = resolveRange(tz, start, end, days);
      const report = await collectExport(url, range.start, range.end);
      const payload = includeCustomInstructions(report, customInstructions);
      if (yaml !== false) {
        const body = yamlStringify(payload) + '\n';
        reply.header('content-type', 'application/yaml; charset=utf-8');
        return reply.code(200).send(body);
      }
      return reply.code(200).send(payload);
    } catch (err) {
      const message = (err as Error)?.message || 'Internal error';
      return reply.code(500).send({ error: message });
    }
  });

  await app.listen({ host, port });
  // eslint-disable-next-line no-console
  console.log(`nightflux server listening on http://${host}:${port}`);

  const stop = async () => {
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

// Auto-start when executed by Node/tsx
void startServer();

export default { startServer };
