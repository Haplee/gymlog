CREATE OR REPLACE FUNCTION get_volume_by_muscle_group(user_uuid UUID)
RETURNS TABLE (muscle_group TEXT, total_volume NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT e.muscle_group, SUM(ws.reps * ws.weight)::NUMERIC as total_volume
  FROM workout_sets ws
  JOIN exercises e ON ws.exercise_id = e.id
  JOIN workouts w ON ws.workout_id = w.id
  WHERE w.user_id = user_uuid
  GROUP BY e.muscle_group;
END; $$ LANGUAGE plpgsql;
