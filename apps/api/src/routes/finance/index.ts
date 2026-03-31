import type { FastifyPluginAsync } from "fastify";
import { getStockQuotes, getExchangeRates } from "../../services/finance.js";

export const financeRoutes: FastifyPluginAsync = async (fastify) => {
  // Stock quotes
  fastify.get<{ Querystring: { symbols: string } }>(
    "/stocks",
    { onRequest: [fastify.authenticateKioskOrAny] },
    async (request) => {
      const symbolsParam = request.query.symbols;
      if (!symbolsParam) {
        throw fastify.httpErrors.badRequest("symbols query parameter required");
      }
      const symbols = symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 20); // Max 20 symbols

      const quotes = await getStockQuotes(symbols);
      return { success: true, data: quotes };
    }
  );

  // Exchange rates
  fastify.get<{ Querystring: { base?: string; targets?: string } }>(
    "/exchange-rates",
    { onRequest: [fastify.authenticateKioskOrAny] },
    async (request) => {
      const base = (request.query.base || "USD").toUpperCase();
      const targetsParam = request.query.targets || "EUR,GBP,JPY,CAD,AUD,CHF,CNY";
      const targets = targetsParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 30);

      const rates = await getExchangeRates(base, targets);
      return { success: true, data: rates, base };
    }
  );
};
