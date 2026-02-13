-- RSS feed subscriptions
CREATE TABLE news_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    feed_url TEXT NOT NULL,
    category TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS news_feeds_user_idx ON news_feeds(user_id);

-- Cached articles
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id UUID NOT NULL REFERENCES news_feeds(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    link TEXT NOT NULL,
    image_url TEXT,
    author TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS news_articles_feed_idx ON news_articles(feed_id);
CREATE UNIQUE INDEX IF NOT EXISTS news_articles_guid_idx ON news_articles(feed_id, guid);
CREATE INDEX IF NOT EXISTS news_articles_published_idx ON news_articles(published_at DESC);
