SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'flashcards'
AND column_name IN ('stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'reps', 'lapses', 'state', 'last_review')
ORDER BY column_name;