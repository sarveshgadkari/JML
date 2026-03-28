-- 027_tri_factor_ranking.sql
-- Adds tri-factor ranking columns and admin RPCs to compute them in batches

-- 1) Columns on public.lawyer_analytics
ALTER TABLE public.lawyer_analytics
  ADD COLUMN IF NOT EXISTS win_rate_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS experience_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS velocity_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tri_factor_last_computed timestamptz;

-- 2) Admin RPC to compute tri-ranks for a batch (by offset/limit)
CREATE OR REPLACE FUNCTION public.admin_compute_tri_ranks_batch(p_batch_size integer, p_offset integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  TRIBUNAL_AVG_HEARINGS integer := 6;
  TRIBUNAL_AVG_DURATION integer := 200;
BEGIN
  -- Optional: ensure only admins
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user') THEN
    IF NOT public.is_admin_user() THEN
      RAISE EXCEPTION 'Only admins can compute tri-factor ranks';
    END IF;
  END IF;

  WITH batch AS (
    SELECT
      la.lawyer_id,
      COALESCE(la.won_cases, 0)::numeric AS wins,
      COALESCE(la.lost_cases, 0)::numeric AS losses,
      COALESCE(la.settled_cases, 0)::numeric AS settlements,
      COALESCE(la.avg_case_duration_days, 0)::numeric AS avg_duration_days,
      COALESCE(la.total_cases, 0)::numeric AS total_cases
    FROM public.lawyer_analytics la
    ORDER BY la.lawyer_id
    OFFSET GREATEST(p_offset, 0)
    LIMIT GREATEST(p_batch_size, 1)
  ),
  computed AS (
    SELECT
      b.lawyer_id,
      -- Win Rate Score: Bayesian smoothing with settlements as 0.5 wins
      LEAST(100, ROUND( (((b.wins + b.settlements * 0.5) + 1) / (NULLIF(b.total_cases,0) + 2)) * 100 ))::int AS win_rate_score,
      -- Experience Score: log10 curve scaled to 0-100
      LEAST(100, ROUND( (LOG(10, (b.total_cases + 1)) / 3) * 100 ))::int AS experience_score,
      -- Velocity Score: hearing/duration efficiency relative to tribunal averages,
      -- multiplied by true win percentage + 0.2 buffer
      CASE
        WHEN b.total_cases = 0 THEN 0
        ELSE
          LEAST(
            100,
            ROUND(
              (
                (
                  GREATEST(0, 100 - ((TRIBUNAL_AVG_HEARINGS::numeric / TRIBUNAL_AVG_HEARINGS::numeric) * 50)) -- hearings avg unknown → use baseline
                  +
                  GREATEST(0, 100 - ((NULLIF(b.avg_duration_days,0) / TRIBUNAL_AVG_DURATION::numeric) * 50))
                ) / 2.0
              )
              * (GREATEST(0, b.wins / NULLIF(b.total_cases,0)) + 0.2)
            )
          )::int
      END AS velocity_score
    FROM batch b
  )
  UPDATE public.lawyer_analytics la
  SET
    win_rate_score = c.win_rate_score,
    experience_score = c.experience_score,
    velocity_score = c.velocity_score,
    tri_factor_last_computed = NOW()
  FROM computed c
  WHERE la.lawyer_id = c.lawyer_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_compute_tri_ranks_batch(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_compute_tri_ranks_batch(integer, integer) TO authenticated;

-- 3) Admin RPC to compute tri-ranks for all rows by looping in batches
CREATE OR REPLACE FUNCTION public.admin_compute_tri_ranks_all(p_batch_size integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer := 0;
  v_done integer := 0;
  v_total integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user') THEN
    IF NOT public.is_admin_user() THEN
      RAISE EXCEPTION 'Only admins can compute tri-factor ranks';
    END IF;
  END IF;

  LOOP
    v_done := public.admin_compute_tri_ranks_batch(p_batch_size, v_offset);
    v_total := v_total + v_done;
    EXIT WHEN v_done = 0;
    v_offset := v_offset + p_batch_size;
    PERFORM pg_sleep(0.1); -- gentle backoff to avoid overload
  END LOOP;

  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_compute_tri_ranks_all(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_compute_tri_ranks_all(integer) TO authenticated;

