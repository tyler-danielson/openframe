import fp from "fastify-plugin";
import { createDatabase, type Database } from "@openframe/database";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

interface DatabasePluginOptions {
  connectionString: string;
}

export const databasePlugin = fp<DatabasePluginOptions>(
  async (fastify, options) => {
    const db = createDatabase(options.connectionString);
    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      fastify.log.info("Database connection closed");
    });
  },
  {
    name: "database",
  }
);
