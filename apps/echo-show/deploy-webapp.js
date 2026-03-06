#!/usr/bin/env node

/**
 * Deploy the web app to the Alexa skill's S3 media bucket.
 *
 * After running `ask deploy`, this script uploads the built web app
 * from web/dist/ to the skill's S3 Media/ folder so the Lambda can
 * reference it in the Alexa.Presentation.HTML.Start directive.
 *
 * Usage: node deploy-webapp.js
 *
 * Prerequisites:
 * - AWS CLI configured (Alexa-hosted skills use ASK CLI credentials)
 * - `ask deploy` already run (creates the S3 bucket)
 * - `npm run build` already run (builds web/dist/)
 */

import { execSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";

const DIST_DIR = join(import.meta.dirname, "web", "dist");
const MEDIA_PREFIX = "Media";

function getSkillS3Bucket() {
  // Alexa-hosted skills store the bucket name in .ask/ask-states.json
  try {
    const askStates = JSON.parse(
      execSync("cat .ask/ask-states.json", { encoding: "utf8" })
    );
    const bucket =
      askStates?.profiles?.default?.skillInfrastructure?.userConfig
        ?.s3Bucket;
    if (bucket) return bucket;
  } catch {
    // Fall through
  }

  // Try environment variable
  if (process.env.S3_PERSISTENCE_BUCKET) {
    return process.env.S3_PERSISTENCE_BUCKET;
  }

  console.error(
    "Could not determine S3 bucket. Run `ask deploy` first, or set S3_PERSISTENCE_BUCKET."
  );
  process.exit(1);
}

function getAllFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  const bucket = getSkillS3Bucket();
  console.log(`Deploying web app to s3://${bucket}/${MEDIA_PREFIX}/`);

  const files = getAllFiles(DIST_DIR);
  console.log(`Found ${files.length} files to upload.`);

  // Sync the dist folder to the S3 Media/ prefix
  try {
    execSync(
      `aws s3 sync "${DIST_DIR}" "s3://${bucket}/${MEDIA_PREFIX}/" --delete --acl public-read`,
      { stdio: "inherit" }
    );
    console.log("Web app deployed successfully!");
    console.log(`URL: https://${bucket}.s3.amazonaws.com/${MEDIA_PREFIX}/index.html`);
  } catch (err) {
    console.error("Failed to deploy web app:", err.message);
    process.exit(1);
  }
}

main();
