-- Set all existing users to advanced mode with onboarding complete
-- New users will have null userMode/onboardingCompleted and see the wizard
UPDATE users
SET preferences = COALESCE(preferences, '{}')::jsonb
  || '{"userMode": "advanced", "onboardingCompleted": true}'::jsonb
WHERE preferences IS NULL
   OR preferences->>'userMode' IS NULL;
