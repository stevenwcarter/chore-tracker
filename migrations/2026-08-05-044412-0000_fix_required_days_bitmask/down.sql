-- Inverse of up.sql: rotate left by one within 7 bits.
-- old = ((new << 1) | (new >> 6)) & 127
UPDATE chores
SET required_days = ((required_days << 1) | (required_days >> 6)) & 127
WHERE required_days <> 0;
