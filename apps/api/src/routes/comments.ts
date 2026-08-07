import type { FastifyInstance } from 'fastify';
import { generateCommentsRequestSchema } from '@insightreply/shared';
import type { CommentGenerator } from '../ai/comment-generator.js';

export interface CommentsRoutesDeps {
  generator: CommentGenerator;
  rateLimitMax: number;
  rateLimitWindow: number;
}

export async function registerCommentRoutes(
  app: FastifyInstance,
  deps: CommentsRoutesDeps,
): Promise<void> {
  app.post('/v1/comments/generate', {
    config: {
      rateLimit: {
        max: deps.rateLimitMax,
        timeWindow: deps.rateLimitWindow,
      },
    },
    handler: async (request, reply) => {
      const parsed = generateCommentsRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((i) => i.message).join(' '),
          },
        });
      }

      const result = await deps.generator.generate(parsed.data);

      return reply.status(200).send({
        requestId: result.requestId,
        postSummary: result.postSummary,
        suggestions: result.suggestions,
      });
    },
  });
}