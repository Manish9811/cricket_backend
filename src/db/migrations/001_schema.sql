-- ============================================================
-- Cricket Scorer — Full Database Schema
-- Run once against your Neon PostgreSQL instance
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  email_verified   BOOLEAN DEFAULT FALSE,
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ──────────────────────────────────────────────
-- TEAMS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL,
  short_name       VARCHAR(10),                  -- e.g. "MI", "CSK"
  logo_url         TEXT,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code      VARCHAR(64) UNIQUE NOT NULL,  -- shareable join token
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_invite_code ON teams(invite_code);

-- ──────────────────────────────────────────────
-- TEAM MEMBERS
-- ──────────────────────────────────────────────
CREATE TYPE team_role AS ENUM ('captain', 'vice_captain', 'player');

CREATE TABLE IF NOT EXISTS team_members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id          UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role             team_role DEFAULT 'player',
  jersey_number    SMALLINT,
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- ──────────────────────────────────────────────
-- TEAM INVITATIONS
-- ──────────────────────────────────────────────
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'declined');

CREATE TABLE IF NOT EXISTS team_invitations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id          UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email            VARCHAR(255) NOT NULL,
  invited_by       UUID NOT NULL REFERENCES users(id),
  token            VARCHAR(128) UNIQUE NOT NULL,
  status           invite_status DEFAULT 'pending',
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- TOURNAMENTS
-- ──────────────────────────────────────────────
CREATE TYPE tournament_format AS ENUM ('league', 'knockout', 'round_robin', 'group_knockout');
CREATE TYPE tournament_status AS ENUM ('upcoming', 'active', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS tournaments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(150) NOT NULL,
  format           tournament_format DEFAULT 'league',
  created_by       UUID NOT NULL REFERENCES users(id),
  start_date       DATE,
  end_date         DATE,
  status           tournament_status DEFAULT 'upcoming',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_teams (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id    UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id          UUID NOT NULL REFERENCES teams(id),
  points           SMALLINT DEFAULT 0,
  matches_played   SMALLINT DEFAULT 0,
  matches_won      SMALLINT DEFAULT 0,
  matches_lost     SMALLINT DEFAULT 0,
  matches_tied     SMALLINT DEFAULT 0,
  net_run_rate     DECIMAL(6,3) DEFAULT 0,
  UNIQUE(tournament_id, team_id)
);

-- ──────────────────────────────────────────────
-- MATCHES
-- ──────────────────────────────────────────────
CREATE TYPE match_type   AS ENUM ('T20', 'ODI', 'Test', 'T10', 'Custom');
CREATE TYPE match_status AS ENUM ('upcoming', 'live', 'completed', 'cancelled', 'abandoned');
CREATE TYPE toss_decision AS ENUM ('bat', 'field');

CREATE TABLE IF NOT EXISTS matches (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR(200),
  match_type       match_type DEFAULT 'T20',
  overs            SMALLINT NOT NULL DEFAULT 20,
  balls_per_over   SMALLINT NOT NULL DEFAULT 6,
  team1_id         UUID NOT NULL REFERENCES teams(id),
  team2_id         UUID NOT NULL REFERENCES teams(id),
  venue            VARCHAR(200),
  scheduled_at     TIMESTAMPTZ,
  status           match_status DEFAULT 'upcoming',
  toss_winner_id   UUID REFERENCES teams(id),
  toss_decision    toss_decision,
  result           TEXT,                         -- "Team A won by 5 wickets"
  winning_team_id  UUID REFERENCES teams(id),
  tournament_id    UUID REFERENCES tournaments(id),
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT diff_teams CHECK (team1_id <> team2_id)
);

CREATE INDEX idx_matches_status    ON matches(status);
CREATE INDEX idx_matches_teams     ON matches(team1_id, team2_id);

-- ──────────────────────────────────────────────
-- MATCH PLAYERS  (availability + playing XI)
-- ──────────────────────────────────────────────
CREATE TYPE availability AS ENUM ('yes', 'no', 'maybe');

CREATE TABLE IF NOT EXISTS match_players (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id         UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id          UUID NOT NULL REFERENCES teams(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  availability     availability DEFAULT 'maybe',
  is_playing       BOOLEAN DEFAULT FALSE,        -- part of playing XI
  batting_order    SMALLINT,                     -- 1-11
  UNIQUE(match_id, user_id)
);

-- ──────────────────────────────────────────────
-- INNINGS
-- ──────────────────────────────────────────────
CREATE TYPE innings_status AS ENUM ('yet_to_start', 'in_progress', 'completed');

CREATE TABLE IF NOT EXISTS innings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id         UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  batting_team_id  UUID NOT NULL REFERENCES teams(id),
  bowling_team_id  UUID NOT NULL REFERENCES teams(id),
  innings_number   SMALLINT NOT NULL,            -- 1 or 2
  total_runs       SMALLINT DEFAULT 0,
  total_wickets    SMALLINT DEFAULT 0,
  total_overs      SMALLINT DEFAULT 0,
  total_balls      SMALLINT DEFAULT 0,           -- legal deliveries count
  extras           JSONB DEFAULT '{"wide":0,"noball":0,"bye":0,"legbye":0,"penalty":0}',
  target           SMALLINT,                     -- set for 2nd innings
  status           innings_status DEFAULT 'yet_to_start',
  current_batsman1_id UUID REFERENCES users(id),
  current_batsman2_id UUID REFERENCES users(id),
  current_bowler_id   UUID REFERENCES users(id),
  striker_id          UUID REFERENCES users(id), -- who is facing
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, innings_number)
);

-- ──────────────────────────────────────────────
-- BALLS  (ball-by-ball — the heart of the system)
-- ──────────────────────────────────────────────
CREATE TYPE extras_type AS ENUM ('none', 'wide', 'noball', 'bye', 'legbye', 'penalty');
CREATE TYPE wicket_type AS ENUM (
  'bowled','caught','lbw','run_out','stumped',
  'hit_wicket','obstructing_field','timed_out','handled_ball'
);

CREATE TABLE IF NOT EXISTS balls (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  innings_id          UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  over_number         SMALLINT NOT NULL,          -- 0-indexed
  ball_number         SMALLINT NOT NULL,          -- legal ball in over (1–6)
  delivery_number     SMALLINT NOT NULL,          -- actual delivery (includes extras)
  batsman_id          UUID NOT NULL REFERENCES users(id),
  non_striker_id      UUID NOT NULL REFERENCES users(id),
  bowler_id           UUID NOT NULL REFERENCES users(id),
  runs_off_bat        SMALLINT NOT NULL DEFAULT 0,
  extras_type         extras_type DEFAULT 'none',
  extras_runs         SMALLINT DEFAULT 0,
  total_runs          SMALLINT GENERATED ALWAYS AS (runs_off_bat + extras_runs) STORED,
  is_wicket           BOOLEAN DEFAULT FALSE,
  wicket_type         wicket_type,
  dismissed_player_id UUID REFERENCES users(id),
  fielder_id          UUID REFERENCES users(id),  -- catcher / run-out fielder
  is_four             BOOLEAN DEFAULT FALSE,
  is_six              BOOLEAN DEFAULT FALSE,
  commentary          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_balls_innings ON balls(innings_id);
CREATE INDEX idx_balls_over    ON balls(innings_id, over_number);

-- ──────────────────────────────────────────────
-- BATTING PERFORMANCES  (per innings per player)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batting_performances (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  innings_id       UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id        UUID NOT NULL REFERENCES users(id),
  team_id          UUID NOT NULL REFERENCES teams(id),
  batting_order    SMALLINT,
  runs             SMALLINT DEFAULT 0,
  balls_faced      SMALLINT DEFAULT 0,
  fours            SMALLINT DEFAULT 0,
  sixes            SMALLINT DEFAULT 0,
  is_out           BOOLEAN DEFAULT FALSE,
  dismissal_type   wicket_type,
  bowler_id        UUID REFERENCES users(id),
  fielder_id       UUID REFERENCES users(id),
  UNIQUE(innings_id, player_id)
);

-- ──────────────────────────────────────────────
-- BOWLING PERFORMANCES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bowling_performances (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  innings_id       UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  player_id        UUID NOT NULL REFERENCES users(id),
  team_id          UUID NOT NULL REFERENCES teams(id),
  balls_bowled     SMALLINT DEFAULT 0,
  runs_conceded    SMALLINT DEFAULT 0,
  wickets          SMALLINT DEFAULT 0,
  maidens          SMALLINT DEFAULT 0,
  wides            SMALLINT DEFAULT 0,
  no_balls         SMALLINT DEFAULT 0,
  UNIQUE(innings_id, player_id)
);

-- ──────────────────────────────────────────────
-- PARTNERSHIPS  (CricHeroes-style tracking)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partnerships (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  innings_id       UUID NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  batsman1_id      UUID NOT NULL REFERENCES users(id),
  batsman2_id      UUID NOT NULL REFERENCES users(id),
  wicket_number    SMALLINT NOT NULL,             -- partnership for X wicket
  runs             SMALLINT DEFAULT 0,
  balls            SMALLINT DEFAULT 0,
  UNIQUE(innings_id, wicket_number)
);

-- ──────────────────────────────────────────────
-- PLAYER CAREER STATS  (denormalized aggregate)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_career_stats (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- batting
  matches_played      INT DEFAULT 0,
  innings_batted      INT DEFAULT 0,
  total_runs          INT DEFAULT 0,
  highest_score       SMALLINT DEFAULT 0,
  not_outs            INT DEFAULT 0,
  fours               INT DEFAULT 0,
  sixes               INT DEFAULT 0,
  fifties             SMALLINT DEFAULT 0,
  hundreds            SMALLINT DEFAULT 0,
  -- bowling
  innings_bowled      INT DEFAULT 0,
  balls_bowled        INT DEFAULT 0,
  runs_conceded       INT DEFAULT 0,
  wickets_taken       INT DEFAULT 0,
  best_bowling_wickets SMALLINT DEFAULT 0,
  best_bowling_runs    SMALLINT DEFAULT 999,
  five_wickets         SMALLINT DEFAULT 0,
  -- fielding
  catches             INT DEFAULT 0,
  run_outs            INT DEFAULT 0,
  stumpings           INT DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────────
CREATE TYPE notification_type AS ENUM ('invite', 'match_reminder', 'match_result', 'system');

CREATE TABLE IF NOT EXISTS notifications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             notification_type DEFAULT 'system',
  title            VARCHAR(200) NOT NULL,
  message          TEXT,
  is_read          BOOLEAN DEFAULT FALSE,
  reference_id     UUID,                          -- match_id or team_id
  reference_type   VARCHAR(20),                   -- 'match' | 'team' | 'invite'
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ──────────────────────────────────────────────
-- AUTO update updated_at on users
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER career_stats_updated_at
  BEFORE UPDATE ON player_career_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
