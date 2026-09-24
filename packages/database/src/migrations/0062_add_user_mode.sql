-- Set all existing users to advanced mode with onboarding complete
-- New users will have null userMode/onboardingCompleted and see the wizard
-- (Skipped once any user has a mode: this migration may be re-applied, and
-- users created since then must still see the onboarding wizard.)
UPDATE users
SET preferences = COALESCE(preferences, '{}')::jsonb
  || '{"userMode": "advanced", "onboardingCompleted": true}'::jsonb
WHERE (preferences IS NULL OR preferences->>'userMode' IS NULL)
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.preferences->>'userMode' IS NOT NULL);
