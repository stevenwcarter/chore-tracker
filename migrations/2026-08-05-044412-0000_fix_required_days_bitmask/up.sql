-- Existing chores.required_days rows were written by the admin form using a
-- Sunday-first layout (Sunday=1, Monday=2 ... Saturday=64). The backend, and
-- now the frontend, use Monday-first (Monday=1 ... Sunday=64). Rotate right by
-- one within 7 bits: Sunday's bit wraps from bit 0 to bit 6.
-- new = ((old >> 1) | (old << 6)) & 127
UPDATE chores
SET required_days = ((required_days >> 1) | (required_days << 6)) & 127
WHERE required_days <> 0;
