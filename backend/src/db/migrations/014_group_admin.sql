-- A "junior admin": elevated only to delete homework in the foreign-
-- language / descriptive-geometry sessions that match their OWN subgroup
-- (see services/subgroup.ts's isForeignLanguage/isDescriptiveGeometry) —
-- not a full admin. Granted by a real admin from the user management panel,
-- same toggle pattern as can_create_plans (migration 007).
ALTER TABLE users ADD COLUMN group_admin BOOLEAN NOT NULL DEFAULT false;
