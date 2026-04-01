-- Add ai_usage table for monthly AI query metering
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  query_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_user_month_idx ON ai_usage(user_id, month);

-- Update existing user_plans JSONB to include new fields (backward compat)
-- Pro plans
UPDATE user_plans
SET limits = limits
  || '{"aiQueriesPerMonth": 1000, "aiSoftCap": true, "maxPhotos": -1, "maxPhotoResolution": 0}'::jsonb
  || jsonb_build_object('features', (COALESCE(limits->'features', '{}'::jsonb) || '{"cameras": true, "sports": true, "news": true, "recipes": true}'::jsonb))
WHERE plan_id = 'pro';

-- Home plans
UPDATE user_plans
SET limits = limits
  || '{"aiQueriesPerMonth": 200, "aiSoftCap": true, "maxPhotos": 500, "maxPhotoResolution": 0}'::jsonb
  || jsonb_build_object('features', (COALESCE(limits->'features', '{}'::jsonb) || '{"cameras": true, "sports": true, "news": true, "recipes": true}'::jsonb))
WHERE plan_id = 'home';

-- Free plans
UPDATE user_plans
SET limits = limits
  || '{"aiQueriesPerMonth": 25, "aiSoftCap": true, "maxPhotos": 100, "maxPhotoResolution": 1080}'::jsonb
  || jsonb_build_object('features', (COALESCE(limits->'features', '{}'::jsonb) || '{"cameras": true, "sports": true, "news": true, "recipes": true}'::jsonb))
WHERE plan_id = 'free';

-- Enterprise plans
UPDATE user_plans
SET limits = limits
  || '{"aiQueriesPerMonth": -1, "aiSoftCap": false, "maxPhotos": -1, "maxPhotoResolution": 0}'::jsonb
  || jsonb_build_object('features', (COALESCE(limits->'features', '{}'::jsonb) || '{"cameras": true, "sports": true, "news": true, "recipes": true}'::jsonb))
WHERE plan_id = 'enterprise';
