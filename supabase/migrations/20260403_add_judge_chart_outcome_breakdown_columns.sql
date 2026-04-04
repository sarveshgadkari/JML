BEGIN;

ALTER TABLE public.judge_analytics
  ADD COLUMN IF NOT EXISTS chart_hearings_1_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_hearings_2_3_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_hearings_4_5_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_hearings_5_plus_cases integer NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_name text,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_1_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_name text,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_2_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_name text,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_3_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_name text,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_4_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_name text,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_lawyer_5_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_name text,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_1_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_name text,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_2_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_name text,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_3_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_name text,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_4_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_name text,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_won integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_lost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_settled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_win_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_loss_rate numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_respondent_5_settlement_rate numeric(6,2) NOT NULL DEFAULT 0,

  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_1_name text,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_1_avg_days numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_2_name text,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_2_avg_days numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_3_name text,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_3_avg_days numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_4_name text,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_4_avg_days numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_5_name text,
  ADD COLUMN IF NOT EXISTS chart_top_duration_lawyer_5_avg_days numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.judge_analytics.chart_top_lawyer_1_name IS 'Top lawyer #1 before this judge (by case volume).';
COMMENT ON COLUMN public.judge_analytics.chart_top_lawyer_1_win_rate IS 'Top lawyer #1 win rate percentage before this judge.';
COMMENT ON COLUMN public.judge_analytics.chart_top_respondent_1_name IS 'Top respondent/promoter #1 before this judge (from case title parsing).';
COMMENT ON COLUMN public.judge_analytics.chart_top_respondent_1_settlement_rate IS 'Top respondent #1 settlement rate percentage before this judge.';
COMMENT ON COLUMN public.judge_analytics.chart_top_duration_lawyer_1_avg_days IS 'Average case duration in days for top duration lawyer #1 before this judge.';

COMMIT;
