SET local check_function_bodies = off;

DROP POLICY "exercise_favorites_write" ON "public"."exercise_favorites";

DROP POLICY "exercise_muscles_select" ON "public"."exercise_muscles";

DROP POLICY "exercise_muscles_write" ON "public"."exercise_muscles";

DROP POLICY "sets_all" ON "public"."workout_sets";

DROP POLICY "workout_sets_own" ON "public"."workout_sets";

DROP POLICY "Avatar images are publicly accessible" ON "storage"."objects";

DROP POLICY "Users can delete their own avatar" ON "storage"."objects";

DROP POLICY "Users can update their own avatar" ON "storage"."objects";

DROP POLICY "Users can upload their own avatar" ON "storage"."objects";

DROP TRIGGER "on_auth_user_created" ON "auth"."users";

DROP VIEW "public"."v_daily_volume";

DROP VIEW "public"."v_last_trained_by_muscle";

DROP VIEW "public"."v_progression_1rm";

DROP VIEW "public"."v_weekly_volume_by_muscle";

ALTER TABLE "public"."ai_coach_audit"
  DROP CONSTRAINT "ai_coach_audit_user_id_fkey";

ALTER TABLE "public"."ai_coach_memory"
  DROP CONSTRAINT "ai_coach_memory_user_id_fkey";

ALTER TABLE "public"."ai_coach_messages"
  DROP CONSTRAINT "ai_coach_messages_user_id_fkey";

ALTER TABLE "public"."ai_coach_suggestions"
  DROP CONSTRAINT "ai_coach_suggestions_user_id_fkey";

ALTER TABLE "public"."ai_coach_usage"
  DROP CONSTRAINT "ai_coach_usage_user_id_fkey";

ALTER TABLE "public"."body_measurements"
  DROP CONSTRAINT "body_measurements_user_id_fkey";

ALTER TABLE "public"."cardio_sessions"
  DROP CONSTRAINT "cardio_sessions_user_id_fkey";

ALTER TABLE "public"."exercise_favorites"
  DROP CONSTRAINT "exercise_favorites_exercise_id_fkey";

ALTER TABLE "public"."exercise_favorites"
  DROP CONSTRAINT "exercise_favorites_user_id_fkey";

ALTER TABLE "public"."exercise_goals"
  DROP CONSTRAINT "exercise_goals_exercise_id_fkey";

ALTER TABLE "public"."exercise_goals"
  DROP CONSTRAINT "exercise_goals_user_id_fkey";

ALTER TABLE "public"."exercise_muscles"
  DROP CONSTRAINT "exercise_muscles_exercise_id_fkey";

ALTER TABLE "public"."exercise_notes"
  DROP CONSTRAINT "exercise_notes_exercise_id_fkey";

ALTER TABLE "public"."exercise_notes"
  DROP CONSTRAINT "exercise_notes_user_id_fkey";

ALTER TABLE "public"."exercise_progression"
  DROP CONSTRAINT "exercise_progression_user_id_fkey";

ALTER TABLE "public"."exercises"
  DROP CONSTRAINT "exercises_user_id_fkey";

ALTER TABLE "public"."health_sessions"
  DROP CONSTRAINT "health_sessions_user_id_fkey";

ALTER TABLE "public"."lift_analyses"
  DROP CONSTRAINT "lift_analyses_user_id_fkey";

ALTER TABLE "public"."lift_analyses"
  DROP CONSTRAINT "lift_analyses_workout_set_id_fkey";

ALTER TABLE "public"."personal_records"
  DROP CONSTRAINT "personal_records_exercise_id_fkey";

ALTER TABLE "public"."personal_records"
  DROP CONSTRAINT "personal_records_user_id_fkey";

ALTER TABLE "public"."personal_records"
  DROP CONSTRAINT "personal_records_workout_set_id_fkey";

ALTER TABLE "public"."profiles"
  DROP CONSTRAINT "profiles_id_fkey";

ALTER TABLE "public"."progression_log"
  DROP CONSTRAINT "progression_log_user_id_fkey";

ALTER TABLE "public"."push_tokens"
  DROP CONSTRAINT "push_tokens_user_id_fkey";

ALTER TABLE "public"."user_routines"
  DROP CONSTRAINT "user_routines_user_id_fkey";

ALTER TABLE "public"."wearable_connections"
  DROP CONSTRAINT "wearable_connections_user_id_fkey";

ALTER TABLE "public"."wearable_daily"
  DROP CONSTRAINT "wearable_daily_user_id_fkey";

ALTER TABLE "public"."wearable_sleep"
  DROP CONSTRAINT "wearable_sleep_user_id_fkey";

ALTER TABLE "public"."workout_sets"
  DROP CONSTRAINT "workout_sets_exercise_id_fkey";

ALTER TABLE "public"."workout_sets"
  DROP CONSTRAINT "workout_sets_workout_id_fkey";

ALTER TABLE "public"."workouts"
  DROP CONSTRAINT "workouts_user_id_fkey";

DROP FUNCTION "public"."ai_coach_add_tokens"(uuid, text, integer);

DROP FUNCTION "public"."ai_coach_consume_quota"(uuid, text, integer);

DROP FUNCTION "public"."ai_coach_month_tokens"();

DROP FUNCTION "public"."ai_coach_purge"();

DROP FUNCTION "public"."cardio_request_hash"(uuid, text, timestamp WITH time zone, integer, numeric, integer, text);

DROP FUNCTION "public"."check_and_update_pr"();

DROP FUNCTION "public"."check_personal_record"();

DROP FUNCTION "public"."get_exercises_with_usage"(uuid);

DROP FUNCTION "public"."get_volume_by_muscle_group"(uuid);

DROP FUNCTION "public"."get_workouts_with_sets"(uuid, integer, timestamp WITH time zone);

DROP FUNCTION "public"."handle_new_user"();

DROP FUNCTION "public"."import_health_sessions"(uuid, jsonb);

DROP FUNCTION "public"."import_history_workouts"(uuid, uuid, jsonb);

DROP FUNCTION "public"."import_operation_key"(uuid, text);

DROP FUNCTION "public"."import_wearable_workouts"(uuid, jsonb);

DROP FUNCTION "public"."pr_rep_band"(integer);

DROP FUNCTION "public"."save_cardio_session"(uuid, uuid, text, timestamp WITH time zone, integer, numeric, integer, text);

DROP FUNCTION "public"."save_workout_with_sets"(uuid, uuid, timestamp WITH time zone, timestamp WITH time zone, jsonb, text, integer, uuid);

DROP FUNCTION "public"."try_boolean"(text);

DROP FUNCTION "public"."try_numeric"(text);

DROP FUNCTION "public"."upsert_wearable_daily"(uuid, jsonb);

DROP FUNCTION "public"."upsert_wearable_sleep"(uuid, jsonb);

DROP FUNCTION "public"."workout_request_hash"(uuid, uuid, timestamp WITH time zone, timestamp WITH time zone, jsonb, text, integer);

DROP TABLE "public"."ai_coach_audit";

DROP TABLE "public"."ai_coach_memory";

DROP TABLE "public"."ai_coach_messages";

DROP TABLE "public"."ai_coach_suggestions";

DROP TABLE "public"."ai_coach_usage";

DROP TABLE "public"."body_measurements";

DROP TABLE "public"."cardio_sessions";

DROP TABLE "public"."exercise_favorites";

DROP TABLE "public"."exercise_goals";

DROP FUNCTION "public"."touch_exercise_goals_updated_at"();

DROP TABLE "public"."exercise_muscles";

DROP TABLE "public"."exercise_notes";

DROP TABLE "public"."exercise_progression";

DROP FUNCTION "public"."set_progression_updated_at"();

DROP TABLE "public"."exercises";

DROP FUNCTION "public"."autoclassify_muscle_group"();

DROP TABLE "public"."health_sessions";

DROP TABLE "public"."lift_analyses";

DROP TABLE "public"."personal_records";

DROP TABLE "public"."profiles";

DROP FUNCTION "public"."update_updated_at"();

DROP TABLE "public"."progression_log";

DROP TABLE "public"."push_tokens";

DROP FUNCTION "public"."touch_push_tokens_updated_at"();

DROP TABLE "public"."routine_templates";

DROP TABLE "public"."user_routines";

DROP TABLE "public"."wearable_connections";

DROP TABLE "public"."wearable_daily";

DROP TABLE "public"."wearable_sleep";

DROP TABLE "public"."workout_sets";

DROP FUNCTION "public"."process_new_set"();

DROP FUNCTION "public"."sync_workout_volume"();

DROP TABLE "public"."workouts";

DROP FUNCTION "public"."finish_workout"();
