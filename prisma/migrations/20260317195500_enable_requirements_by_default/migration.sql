UPDATE "project_section"
SET
  "enabled" = true,
  "enabledAt" = COALESCE("enabledAt", CURRENT_TIMESTAMP),
  "disabledAt" = NULL,
  "disabledBy" = NULL
WHERE
  "sectionKey" = 'requirements'
  AND "enabled" = false
  AND "disabledAt" IS NULL;

