import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { acceptQuoteSchema } from "../schemas.js";
import type { QuotesService } from "../../modules/quotes/quotes.service.js";

export function registerPublicQuotesRoutes(
  app: FastifyInstance,
  quotesService: QuotesService,
) {
  app.get("/public/quotes/:quoteId", async (request) => {
    const input = z
      .object({
        quoteId: z.string().min(1),
        token: z.string().min(32).max(240),
      })
      .parse({
        ...(request.params as object),
        ...(request.query as object),
      });

    return quotesService.getPublicQuote(input.quoteId, input.token);
  });

  app.post("/public/quotes/:quoteId/accept", async (request, reply) => {
    const input = acceptQuoteSchema.parse({
      ...(request.body as object),
      quoteId: (request.params as { quoteId: string }).quoteId,
    });
    const acceptance = await quotesService.accept(input);
    return reply.code(200).send(acceptance);
  });
}
