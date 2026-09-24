-- Lets the group see a countdown to each other's birthdays (new "Дни
-- рождения" tab). Nullable — existing accounts start without one until an
-- admin fills it in via user management (routes/admin.ts).
ALTER TABLE users ADD COLUMN birth_date DATE;
