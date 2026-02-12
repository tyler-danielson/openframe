import "dotenv/config";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main() {
  const config = loadConfig();

  // Ensure auto-generated secrets are available via process.env
  // (settings/setup routes read ENCRYPTION_KEY from process.env for encrypt/decrypt)
  if (!process.env.ENCRYPTION_KEY && config.encryptionKey) {
    process.env.ENCRYPTION_KEY = config.encryptionKey;
  }

  const app = await buildApp(config);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    app.log.info(`Server running at http://localhost:${config.port}`);
    app.log.info(`API docs available at http://localhost:${config.port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
