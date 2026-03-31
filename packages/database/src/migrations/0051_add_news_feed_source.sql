-- Add source column to news_feeds for per-source connection management
DO $$ BEGIN
  ALTER TABLE news_feeds ADD COLUMN source TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Backfill existing feeds by URL pattern
UPDATE news_feeds SET source = 'nytimes' WHERE source IS NULL AND feed_url LIKE '%rss.nytimes.com%';
UPDATE news_feeds SET source = 'bbc' WHERE source IS NULL AND feed_url LIKE '%feeds.bbci.co.uk%';
UPDATE news_feeds SET source = 'reuters' WHERE source IS NULL AND feed_url LIKE '%reutersagency.com%';
UPDATE news_feeds SET source = 'npr' WHERE source IS NULL AND feed_url LIKE '%feeds.npr.org%';
UPDATE news_feeds SET source = 'ars-technica' WHERE source IS NULL AND feed_url LIKE '%feeds.arstechnica.com%';
UPDATE news_feeds SET source = 'techcrunch' WHERE source IS NULL AND feed_url LIKE '%techcrunch.com%';
UPDATE news_feeds SET source = 'the-verge' WHERE source IS NULL AND feed_url LIKE '%theverge.com%';
UPDATE news_feeds SET source = 'hacker-news' WHERE source IS NULL AND feed_url LIKE '%hnrss.org%';
UPDATE news_feeds SET source = 'nasa' WHERE source IS NULL AND feed_url LIKE '%nasa.gov%';
UPDATE news_feeds SET source = 'espn' WHERE source IS NULL AND feed_url LIKE '%espn.com%';
UPDATE news_feeds SET source = 'cnbc' WHERE source IS NULL AND feed_url LIKE '%cnbc.com%';
