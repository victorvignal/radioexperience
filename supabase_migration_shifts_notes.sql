-- Migration: add structured notes and source tracking to shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS reservation_note boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_note text,
  ADD COLUMN IF NOT EXISTS frequency_note text,
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS source_date date;

-- Index for scoped deactivation queries
CREATE INDEX IF NOT EXISTS idx_shifts_location_specialty_batch 
  ON public.shifts (location, specialty, source_batch_id) 
  WHERE is_active = true;
