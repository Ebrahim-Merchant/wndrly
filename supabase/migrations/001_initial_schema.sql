-- ============================================================
-- Wndrly (Trek) - PostgreSQL Migration from SQLite
-- Generated: 2026-06-03
-- Source: ~/trek/data/travel.db
-- Target: Supabase project xfvayfokefudhxtlcprj (wndrly)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  username              TEXT UNIQUE NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'user',
  maps_api_key          TEXT,
  unsplash_api_key      TEXT,
  openweather_api_key   TEXT,
  avatar                TEXT,
  oidc_sub              TEXT,
  oidc_issuer           TEXT,
  last_login            TIMESTAMP,
  mfa_enabled           INTEGER DEFAULT 0,
  mfa_secret            TEXT,
  mfa_backup_codes      TEXT,
  must_change_password  INTEGER DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  immich_url            TEXT,
  immich_api_key        TEXT,
  synology_url          TEXT,
  synology_username     TEXT,
  synology_password     TEXT,
  synology_sid          TEXT,
  synology_skip_ssl     INTEGER NOT NULL DEFAULT 0,
  synology_did          TEXT,
  first_seen_version    TEXT NOT NULL DEFAULT '0.0.0',
  login_count           INTEGER NOT NULL DEFAULT 0,
  immich_auto_upload    INTEGER NOT NULL DEFAULT 0,
  password_version      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- TABLE: settings
-- ============================================================
CREATE TABLE settings (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   TEXT,
  UNIQUE(user_id, key)
);

-- ============================================================
-- TABLE: trips
-- ============================================================
CREATE TABLE trips (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  start_date    TEXT,
  end_date      TEXT,
  currency      TEXT DEFAULT 'EUR',
  cover_image   TEXT,
  is_archived   INTEGER DEFAULT 0,
  reminder_days INTEGER DEFAULT 3,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_created_at ON trips(created_at DESC);

-- ============================================================
-- TABLE: days
-- ============================================================
CREATE TABLE days (
  id          SERIAL PRIMARY KEY,
  trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number  INTEGER NOT NULL,
  date        TEXT,
  notes       TEXT,
  title       TEXT,
  UNIQUE(trip_id, day_number)
);
CREATE INDEX idx_days_trip_id ON days(trip_id);

-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#6366f1',
  icon       TEXT DEFAULT '📍',
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: tags
-- ============================================================
CREATE TABLE tags (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#10b981',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: places
-- ============================================================
CREATE TABLE places (
  id                   SERIAL PRIMARY KEY,
  trip_id              INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  lat                  FLOAT,
  lng                  FLOAT,
  address              TEXT,
  category_id          INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price                FLOAT,
  currency             TEXT,
  reservation_status   TEXT DEFAULT 'none',
  reservation_notes    TEXT,
  reservation_datetime TEXT,
  place_time           TEXT,
  end_time             TEXT,
  duration_minutes     INTEGER DEFAULT 60,
  notes                TEXT,
  image_url            TEXT,
  google_place_id      TEXT,
  website              TEXT,
  phone                TEXT,
  transport_mode       TEXT DEFAULT 'walking',
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  osm_id               TEXT,
  route_geometry       TEXT
);
CREATE INDEX idx_places_trip_id ON places(trip_id);
CREATE INDEX idx_places_category_id ON places(category_id);

-- ============================================================
-- TABLE: place_tags
-- ============================================================
CREATE TABLE place_tags (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (place_id, tag_id)
);
CREATE INDEX idx_place_tags_place_id ON place_tags(place_id);
CREATE INDEX idx_place_tags_tag_id ON place_tags(tag_id);

-- ============================================================
-- TABLE: day_assignments
-- ============================================================
CREATE TABLE day_assignments (
  id                   SERIAL PRIMARY KEY,
  day_id               INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  place_id             INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  order_index          INTEGER DEFAULT 0,
  notes                TEXT,
  reservation_status   TEXT DEFAULT 'none',
  reservation_notes    TEXT,
  reservation_datetime TEXT,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assignment_time      TEXT,
  assignment_end_time  TEXT
);
CREATE INDEX idx_day_assignments_day_id ON day_assignments(day_id);
CREATE INDEX idx_day_assignments_place_id ON day_assignments(place_id);

-- ============================================================
-- TABLE: packing_bags (must come before packing_items)
-- ============================================================
CREATE TABLE packing_bags (
  id                  SERIAL PRIMARY KEY,
  trip_id             INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  color               TEXT NOT NULL DEFAULT '#6366f1',
  weight_limit_grams  INTEGER,
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL
);

-- ============================================================
-- TABLE: packing_items
-- ============================================================
CREATE TABLE packing_items (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  checked       INTEGER DEFAULT 0,
  category      TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  weight_grams  INTEGER,
  bag_id        INTEGER REFERENCES packing_bags(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_packing_items_trip_id ON packing_items(trip_id);

-- ============================================================
-- TABLE: photos
-- ============================================================
CREATE TABLE photos (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id        INTEGER REFERENCES days(id) ON DELETE SET NULL,
  place_id      INTEGER REFERENCES places(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  caption       TEXT,
  taken_at      TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_photos_trip_id ON photos(trip_id);
CREATE INDEX idx_photos_day_id ON photos(day_id);
CREATE INDEX idx_photos_place_id ON photos(place_id);

-- ============================================================
-- TABLE: collab_notes (must come before trip_files)
-- ============================================================
CREATE TABLE collab_notes (
  id         SERIAL PRIMARY KEY,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT DEFAULT 'General',
  title      TEXT NOT NULL,
  content    TEXT,
  color      TEXT DEFAULT '#6366f1',
  pinned     INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  website    TEXT
);
CREATE INDEX idx_collab_notes_trip ON collab_notes(trip_id);

-- ============================================================
-- TABLE: reservations (must come before trip_files - circular dep handled below)
-- ============================================================
CREATE TABLE reservations (
  id                    SERIAL PRIMARY KEY,
  trip_id               INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_id                INTEGER REFERENCES days(id) ON DELETE SET NULL,
  place_id              INTEGER REFERENCES places(id) ON DELETE SET NULL,
  assignment_id         INTEGER REFERENCES day_assignments(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  reservation_time      TEXT,
  reservation_end_time  TEXT,
  location              TEXT,
  confirmation_number   TEXT,
  notes                 TEXT,
  status                TEXT DEFAULT 'pending',
  type                  TEXT DEFAULT 'other',
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata              TEXT,
  day_plan_position     FLOAT DEFAULT NULL,
  needs_review          INTEGER NOT NULL DEFAULT 0,
  end_day_id            INTEGER REFERENCES days(id) ON DELETE SET NULL
  -- accommodation_id added after day_accommodations
);
CREATE INDEX idx_reservations_trip_id ON reservations(trip_id);
CREATE INDEX idx_reservations_day_id ON reservations(day_id);

-- ============================================================
-- TABLE: day_accommodations
-- ============================================================
CREATE TABLE day_accommodations (
  id           SERIAL PRIMARY KEY,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id     INTEGER REFERENCES places(id) ON DELETE SET NULL,
  start_day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  end_day_id   INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  check_in     TEXT,
  check_in_end TEXT,
  check_out    TEXT,
  confirmation TEXT,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_day_accommodations_trip_id ON day_accommodations(trip_id);
CREATE INDEX idx_day_accommodations_start_day_id ON day_accommodations(start_day_id);
CREATE INDEX idx_day_accommodations_end_day_id ON day_accommodations(end_day_id);

-- Add accommodation_id to reservations (deferred FK)
ALTER TABLE reservations ADD COLUMN accommodation_id INTEGER REFERENCES day_accommodations(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: trip_files
-- ============================================================
CREATE TABLE trip_files (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id      INTEGER REFERENCES places(id) ON DELETE SET NULL,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  description   TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note_id       INTEGER REFERENCES collab_notes(id) ON DELETE SET NULL,
  uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  starred       INTEGER DEFAULT 0,
  deleted_at    TEXT
);
CREATE INDEX idx_trip_files_trip_id ON trip_files(trip_id);

-- ============================================================
-- TABLE: trip_members
-- ============================================================
CREATE TABLE trip_members (
  id         SERIAL PRIMARY KEY,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by INTEGER REFERENCES users(id),
  added_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trip_id, user_id)
);
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user_id ON trip_members(user_id);

-- ============================================================
-- TABLE: day_notes
-- ============================================================
CREATE TABLE day_notes (
  id         SERIAL PRIMARY KEY,
  day_id     INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  time       TEXT,
  icon       TEXT DEFAULT '📝',
  sort_order FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_day_notes_day_id ON day_notes(day_id);

-- ============================================================
-- TABLE: app_settings
-- ============================================================
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ============================================================
-- TABLE: budget_items
-- ============================================================
CREATE TABLE budget_items (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'Other',
  name            TEXT NOT NULL,
  total_price     FLOAT NOT NULL DEFAULT 0,
  persons         INTEGER DEFAULT NULL,
  days            INTEGER DEFAULT NULL,
  note            TEXT,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_by_user_id INTEGER REFERENCES users(id),
  expense_date    TEXT DEFAULT NULL,
  reservation_id  INTEGER REFERENCES reservations(id) ON DELETE SET NULL DEFAULT NULL
);
CREATE INDEX idx_budget_items_trip_id ON budget_items(trip_id);

-- ============================================================
-- TABLE: budget_item_members
-- ============================================================
CREATE TABLE budget_item_members (
  id             SERIAL PRIMARY KEY,
  budget_item_id INTEGER NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paid           INTEGER NOT NULL DEFAULT 0,
  UNIQUE(budget_item_id, user_id)
);
CREATE INDEX idx_budget_item_members_item ON budget_item_members(budget_item_id);
CREATE INDEX idx_budget_item_members_user ON budget_item_members(user_id);

-- ============================================================
-- TABLE: budget_category_order
-- ============================================================
CREATE TABLE budget_category_order (
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (trip_id, category)
);

-- ============================================================
-- TABLE: addons
-- ============================================================
CREATE TABLE addons (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL DEFAULT 'global',
  icon        TEXT DEFAULT 'Puzzle',
  enabled     INTEGER DEFAULT 0,
  config      TEXT DEFAULT '{}',
  sort_order  INTEGER DEFAULT 0
);

-- ============================================================
-- TABLE: vacay_plans
-- ============================================================
CREATE TABLE vacay_plans (
  id                       SERIAL PRIMARY KEY,
  owner_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_weekends           INTEGER DEFAULT 1,
  holidays_enabled         INTEGER DEFAULT 0,
  holidays_region          TEXT DEFAULT '',
  company_holidays_enabled INTEGER DEFAULT 1,
  carry_over_enabled       INTEGER DEFAULT 1,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  weekend_days             TEXT DEFAULT '0,6',
  week_start               INTEGER NOT NULL DEFAULT 1,
  UNIQUE(owner_id)
);

-- ============================================================
-- TABLE: vacay_plan_members
-- ============================================================
CREATE TABLE vacay_plan_members (
  id         SERIAL PRIMARY KEY,
  plan_id    INTEGER NOT NULL REFERENCES vacay_plans(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, user_id)
);

-- ============================================================
-- TABLE: vacay_user_colors
-- ============================================================
CREATE TABLE vacay_user_colors (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES vacay_plans(id) ON DELETE CASCADE,
  color   TEXT DEFAULT '#6366f1',
  UNIQUE(user_id, plan_id)
);

-- ============================================================
-- TABLE: vacay_years
-- ============================================================
CREATE TABLE vacay_years (
  id      SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES vacay_plans(id) ON DELETE CASCADE,
  year    INTEGER NOT NULL,
  UNIQUE(plan_id, year)
);

-- ============================================================
-- TABLE: vacay_user_years
-- ============================================================
CREATE TABLE vacay_user_years (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id       INTEGER NOT NULL REFERENCES vacay_plans(id) ON DELETE CASCADE,
  year          INTEGER NOT NULL,
  vacation_days INTEGER DEFAULT 30,
  carried_over  INTEGER DEFAULT 0,
  UNIQUE(user_id, plan_id, year)
);

-- ============================================================
-- TABLE: vacay_entries
-- ============================================================
CREATE TABLE vacay_entries (
  id      SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES vacay_plans(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  note    TEXT DEFAULT '',
  UNIQUE(user_id, plan_id, date)
);

-- ============================================================
-- TABLE: vacay_company_holidays
-- ============================================================
CREATE TABLE vacay_company_holidays (
  id      SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES vacay_plans(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  note    TEXT DEFAULT '',
  UNIQUE(plan_id, date)
);

-- ============================================================
-- TABLE: vacay_holiday_calendars
-- ============================================================
CREATE TABLE vacay_holiday_calendars (
  id         SERIAL PRIMARY KEY,
  plan_id    INTEGER NOT NULL REFERENCES vacay_plans(id) ON DELETE CASCADE,
  region     TEXT NOT NULL,
  label      TEXT,
  color      TEXT NOT NULL DEFAULT '#fecaca',
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLE: collab_polls
-- ============================================================
CREATE TABLE collab_polls (
  id         SERIAL PRIMARY KEY,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  options    TEXT NOT NULL,
  multiple   INTEGER DEFAULT 0,
  closed     INTEGER DEFAULT 0,
  deadline   TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_collab_polls_trip ON collab_polls(trip_id);

-- ============================================================
-- TABLE: collab_poll_votes
-- ============================================================
CREATE TABLE collab_poll_votes (
  id           SERIAL PRIMARY KEY,
  poll_id      INTEGER NOT NULL REFERENCES collab_polls(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(poll_id, user_id, option_index)
);

-- ============================================================
-- TABLE: collab_messages
-- ============================================================
CREATE TABLE collab_messages (
  id         SERIAL PRIMARY KEY,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  reply_to   INTEGER REFERENCES collab_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted    INTEGER DEFAULT 0
);
CREATE INDEX idx_collab_messages_trip ON collab_messages(trip_id);

-- ============================================================
-- TABLE: collab_message_reactions
-- ============================================================
CREATE TABLE collab_message_reactions (
  id         SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES collab_messages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX idx_collab_reactions_msg ON collab_message_reactions(message_id);

-- ============================================================
-- TABLE: assignment_participants
-- ============================================================
CREATE TABLE assignment_participants (
  id            SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES day_assignments(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(assignment_id, user_id)
);
CREATE INDEX idx_assignment_participants_assignment ON assignment_participants(assignment_id);

-- ============================================================
-- TABLE: audit_log
-- ============================================================
CREATE TABLE audit_log (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  resource   TEXT,
  details    TEXT,
  ip         TEXT
);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE notifications (
  id                SERIAL PRIMARY KEY,
  type              TEXT NOT NULL CHECK(type IN ('simple', 'boolean', 'navigate')),
  scope             TEXT NOT NULL CHECK(scope IN ('trip', 'user', 'admin')),
  target            INTEGER NOT NULL,
  sender_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_key         TEXT NOT NULL,
  title_params      TEXT DEFAULT '{}',
  text_key          TEXT NOT NULL,
  text_params       TEXT DEFAULT '{}',
  positive_text_key TEXT,
  negative_text_key TEXT,
  positive_callback TEXT,
  negative_callback TEXT,
  response          TEXT CHECK(response IN ('positive', 'negative')),
  navigate_text_key TEXT,
  navigate_target   TEXT,
  is_read           INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_target_scope ON notifications(target, scope);

-- ============================================================
-- TABLE: notification_channel_preferences
-- ============================================================
CREATE TABLE notification_channel_preferences (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel    TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, event_type, channel)
);
CREATE INDEX idx_ncp_user ON notification_channel_preferences(user_id);

-- ============================================================
-- TABLE: invite_tokens
-- ============================================================
CREATE TABLE invite_tokens (
  id         SERIAL PRIMARY KEY,
  token      TEXT UNIQUE NOT NULL,
  max_uses   INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: packing_category_assignees
-- ============================================================
CREATE TABLE packing_category_assignees (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(trip_id, category_name, user_id)
);

-- ============================================================
-- TABLE: packing_templates
-- ============================================================
CREATE TABLE packing_templates (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: packing_template_categories
-- ============================================================
CREATE TABLE packing_template_categories (
  id          SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES packing_templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLE: packing_template_items
-- ============================================================
CREATE TABLE packing_template_items (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES packing_template_categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLE: packing_bag_members
-- ============================================================
CREATE TABLE packing_bag_members (
  bag_id  INTEGER NOT NULL REFERENCES packing_bags(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (bag_id, user_id)
);
CREATE INDEX idx_packing_bag_members_bag ON packing_bag_members(bag_id);

-- ============================================================
-- TABLE: visited_countries
-- ============================================================
CREATE TABLE visited_countries (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, country_code)
);

-- ============================================================
-- TABLE: bucket_list
-- ============================================================
CREATE TABLE bucket_list (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  lat          FLOAT,
  lng          FLOAT,
  country_code TEXT,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  target_date  TEXT DEFAULT NULL
);

-- ============================================================
-- TABLE: file_links
-- ============================================================
CREATE TABLE file_links (
  id             SERIAL PRIMARY KEY,
  file_id        INTEGER NOT NULL REFERENCES trip_files(id) ON DELETE CASCADE,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
  assignment_id  INTEGER REFERENCES day_assignments(id) ON DELETE CASCADE,
  place_id       INTEGER REFERENCES places(id) ON DELETE CASCADE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, reservation_id),
  UNIQUE(file_id, assignment_id),
  UNIQUE(file_id, place_id)
);

-- ============================================================
-- TABLE: share_tokens
-- ============================================================
CREATE TABLE share_tokens (
  id              SERIAL PRIMARY KEY,
  trip_id         INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  share_map       INTEGER DEFAULT 1,
  share_bookings  INTEGER DEFAULT 1,
  share_packing   INTEGER DEFAULT 0,
  share_budget    INTEGER DEFAULT 0,
  share_collab    INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at      TEXT
);
CREATE INDEX idx_share_tokens_token ON share_tokens(token);

-- ============================================================
-- TABLE: mcp_tokens
-- ============================================================
CREATE TABLE mcp_tokens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP
);
CREATE UNIQUE INDEX idx_mcp_tokens_hash ON mcp_tokens(token_hash);

-- ============================================================
-- TABLE: photo_providers
-- ============================================================
CREATE TABLE photo_providers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT DEFAULT 'Image',
  enabled     INTEGER DEFAULT 0,
  sort_order  INTEGER DEFAULT 0
);

-- ============================================================
-- TABLE: photo_provider_fields
-- ============================================================
CREATE TABLE photo_provider_fields (
  id           SERIAL PRIMARY KEY,
  provider_id  TEXT NOT NULL REFERENCES photo_providers(id) ON DELETE CASCADE,
  field_key    TEXT NOT NULL,
  label        TEXT NOT NULL,
  input_type   TEXT NOT NULL DEFAULT 'text',
  placeholder  TEXT,
  required     INTEGER DEFAULT 0,
  secret       INTEGER DEFAULT 0,
  settings_key TEXT,
  payload_key  TEXT,
  sort_order   INTEGER DEFAULT 0,
  hint         TEXT,
  UNIQUE(provider_id, field_key)
);

-- ============================================================
-- TABLE: trip_album_links
-- ============================================================
CREATE TABLE trip_album_links (
  id           SERIAL PRIMARY KEY,
  trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,
  album_id     TEXT NOT NULL,
  album_name   TEXT NOT NULL DEFAULT '',
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  last_synced_at TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  passphrase   TEXT DEFAULT NULL,
  UNIQUE(trip_id, user_id, provider, album_id)
);
CREATE INDEX idx_trip_album_links_trip ON trip_album_links(trip_id);

-- ============================================================
-- TABLE: todo_items
-- ============================================================
CREATE TABLE todo_items (
  id               SERIAL PRIMARY KEY,
  trip_id          INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  checked          INTEGER DEFAULT 0,
  category         TEXT,
  sort_order       INTEGER DEFAULT 0,
  due_date         TEXT,
  description      TEXT,
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  priority         INTEGER DEFAULT 0,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reminded_at      TIMESTAMP
);
CREATE INDEX idx_todo_items_trip_id ON todo_items(trip_id);

-- ============================================================
-- TABLE: todo_category_assignees
-- ============================================================
CREATE TABLE todo_category_assignees (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(trip_id, category_name, user_id)
);

-- ============================================================
-- TABLE: place_regions
-- ============================================================
CREATE TABLE place_regions (
  place_id     INTEGER PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  region_code  TEXT NOT NULL,
  region_name  TEXT NOT NULL
);
CREATE INDEX idx_place_regions_country ON place_regions(country_code);
CREATE INDEX idx_place_regions_region ON place_regions(region_code);

-- ============================================================
-- TABLE: visited_regions
-- ============================================================
CREATE TABLE visited_regions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_code  TEXT NOT NULL,
  region_name  TEXT NOT NULL,
  country_code TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, region_code)
);
CREATE INDEX idx_visited_regions_country ON visited_regions(country_code);

-- ============================================================
-- TABLE: reservation_day_positions
-- ============================================================
CREATE TABLE reservation_day_positions (
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  day_id         INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  position       FLOAT NOT NULL,
  PRIMARY KEY (reservation_id, day_id)
);

-- ============================================================
-- TABLE: password_reset_tokens
-- ============================================================
CREATE TABLE password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_ip TEXT
);
CREATE INDEX idx_prt_user ON password_reset_tokens(user_id);
CREATE INDEX idx_prt_hash ON password_reset_tokens(token_hash);

-- ============================================================
-- TABLE: migrations (internal tracking)
-- ============================================================
CREATE TABLE migrations (
  id        SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name      VARCHAR NOT NULL
);

-- ============================================================
-- TABLE: oauth_clients
-- ============================================================
CREATE TABLE oauth_clients (
  id                         TEXT PRIMARY KEY,
  user_id                    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name                       TEXT NOT NULL,
  client_id                  TEXT UNIQUE NOT NULL,
  client_secret_hash         TEXT NOT NULL,
  redirect_uris              TEXT NOT NULL DEFAULT '[]',
  allowed_scopes             TEXT NOT NULL DEFAULT '[]',
  created_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_public                  INTEGER NOT NULL DEFAULT 0,
  created_via                TEXT NOT NULL DEFAULT 'settings_ui',
  allows_client_credentials  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_oauth_clients_user ON oauth_clients(user_id);
CREATE UNIQUE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);

-- ============================================================
-- TABLE: oauth_consents
-- ============================================================
CREATE TABLE oauth_consents (
  id         SERIAL PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scopes     TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, user_id)
);

-- ============================================================
-- TABLE: oauth_tokens
-- ============================================================
CREATE TABLE oauth_tokens (
  id                        SERIAL PRIMARY KEY,
  client_id                 TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash         TEXT UNIQUE NOT NULL,
  refresh_token_hash        TEXT UNIQUE NOT NULL,
  scopes                    TEXT NOT NULL DEFAULT '[]',
  access_token_expires_at   TIMESTAMP NOT NULL,
  refresh_token_expires_at  TIMESTAMP NOT NULL,
  revoked_at                TIMESTAMP,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  parent_token_id           INTEGER REFERENCES oauth_tokens(id),
  audience                  TEXT
);
CREATE INDEX idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE UNIQUE INDEX idx_oauth_tokens_access ON oauth_tokens(access_token_hash);
CREATE UNIQUE INDEX idx_oauth_tokens_refresh ON oauth_tokens(refresh_token_hash);
CREATE INDEX idx_oauth_tokens_parent ON oauth_tokens(parent_token_id);

-- ============================================================
-- TABLE: journeys
-- ============================================================
CREATE TABLE journeys (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  title          TEXT NOT NULL,
  subtitle       TEXT,
  cover_gradient TEXT,
  status         TEXT DEFAULT 'draft',
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL,
  cover_image    TEXT
);
CREATE INDEX idx_journeys_user ON journeys(user_id);

-- ============================================================
-- TABLE: journey_trips
-- ============================================================
CREATE TABLE journey_trips (
  journey_id INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  added_at   BIGINT NOT NULL,
  PRIMARY KEY (journey_id, trip_id)
);
CREATE INDEX idx_journey_trips_journey ON journey_trips(journey_id);

-- ============================================================
-- TABLE: journey_entries
-- ============================================================
CREATE TABLE journey_entries (
  id              SERIAL PRIMARY KEY,
  journey_id      INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  source_trip_id  INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  source_place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
  author_id       INTEGER NOT NULL REFERENCES users(id),
  type            TEXT NOT NULL,
  title           TEXT,
  story           TEXT,
  entry_date      TEXT NOT NULL,
  entry_time      TEXT,
  location_name   TEXT,
  location_lat    FLOAT,
  location_lng    FLOAT,
  mood            TEXT,
  weather         TEXT,
  tags            TEXT,
  visibility      TEXT DEFAULT 'private',
  sort_order      INTEGER DEFAULT 0,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL,
  pros_cons       TEXT
);
CREATE INDEX idx_journey_entries_journey ON journey_entries(journey_id, entry_date);
CREATE INDEX idx_journey_entries_source ON journey_entries(source_place_id);
CREATE INDEX idx_journey_entries_order ON journey_entries(journey_id, entry_date, sort_order);

-- ============================================================
-- TABLE: journey_contributors
-- ============================================================
CREATE TABLE journey_contributors (
  journey_id     INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  role           TEXT NOT NULL,
  added_at       BIGINT NOT NULL,
  hide_skeletons INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (journey_id, user_id)
);
CREATE INDEX idx_journey_contributors_user ON journey_contributors(user_id);

-- ============================================================
-- TABLE: journey_share_tokens
-- ============================================================
CREATE TABLE journey_share_tokens (
  id             SERIAL PRIMARY KEY,
  journey_id     INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  share_timeline INTEGER DEFAULT 1,
  share_gallery  INTEGER DEFAULT 1,
  share_map      INTEGER DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_journey_share_journey ON journey_share_tokens(journey_id);

-- ============================================================
-- TABLE: trek_photos
-- ============================================================
CREATE TABLE trek_photos (
  id             SERIAL PRIMARY KEY,
  provider       TEXT NOT NULL,
  asset_id       TEXT,
  owner_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  file_path      TEXT,
  thumbnail_path TEXT,
  width          INTEGER,
  height         INTEGER,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  passphrase     TEXT DEFAULT NULL
);
CREATE UNIQUE INDEX idx_trek_photos_provider_asset ON trek_photos(provider, asset_id, owner_id) WHERE asset_id IS NOT NULL;
CREATE INDEX idx_trek_photos_owner ON trek_photos(owner_id);

-- ============================================================
-- TABLE: trip_photos
-- ============================================================
CREATE TABLE trip_photos (
  id            SERIAL PRIMARY KEY,
  trip_id       INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id      INTEGER NOT NULL REFERENCES trek_photos(id) ON DELETE CASCADE,
  shared        INTEGER NOT NULL DEFAULT 1,
  album_link_id INTEGER REFERENCES trip_album_links(id) ON DELETE SET NULL,
  added_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trip_id, user_id, photo_id)
);
CREATE INDEX idx_trip_photos_trip ON trip_photos(trip_id);
CREATE INDEX idx_trip_photos_photo ON trip_photos(photo_id);

-- ============================================================
-- TABLE: user_notice_dismissals
-- ============================================================
CREATE TABLE user_notice_dismissals (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice_id    TEXT NOT NULL,
  dismissed_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, notice_id)
);

-- ============================================================
-- TABLE: google_place_photo_meta
-- ============================================================
CREATE TABLE google_place_photo_meta (
  place_id    TEXT PRIMARY KEY,
  attribution TEXT,
  fetched_at  BIGINT NOT NULL,
  error_at    BIGINT
);

-- ============================================================
-- TABLE: place_details_cache
-- ============================================================
CREATE TABLE place_details_cache (
  place_id     TEXT NOT NULL,
  lang         TEXT NOT NULL DEFAULT '',
  expanded     INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  fetched_at   BIGINT NOT NULL,
  PRIMARY KEY (place_id, lang, expanded)
);

-- ============================================================
-- TABLE: trek_photo_cache_meta
-- ============================================================
CREATE TABLE trek_photo_cache_meta (
  cache_key    TEXT PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  fetched_at   BIGINT NOT NULL
);
CREATE INDEX idx_trek_photo_cache_meta_fetched_at ON trek_photo_cache_meta(fetched_at);

-- ============================================================
-- TABLE: reservation_endpoints
-- ============================================================
CREATE TABLE reservation_endpoints (
  id             SERIAL PRIMARY KEY,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  sequence       INTEGER NOT NULL DEFAULT 0,
  name           TEXT NOT NULL,
  code           TEXT,
  lat            FLOAT NOT NULL,
  lng            FLOAT NOT NULL,
  timezone       TEXT,
  local_time     TEXT,
  local_date     TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_reservation_endpoints_reservation_id ON reservation_endpoints(reservation_id);

-- ============================================================
-- TABLE: idempotency_keys
-- ============================================================
CREATE TABLE idempotency_keys (
  key           TEXT NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method        TEXT NOT NULL,
  path          TEXT NOT NULL,
  status_code   INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at    BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  PRIMARY KEY (key, user_id, method, path)
);
CREATE INDEX idx_idempotency_keys_created ON idempotency_keys(created_at);

-- ============================================================
-- TABLE: journey_photos
-- ============================================================
CREATE TABLE journey_photos (
  id         SERIAL PRIMARY KEY,
  journey_id INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  photo_id   INTEGER NOT NULL REFERENCES trek_photos(id) ON DELETE CASCADE,
  caption    TEXT,
  shared     INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  provider   TEXT,
  asset_id   TEXT,
  owner_id   INTEGER,
  created_at BIGINT NOT NULL,
  UNIQUE(journey_id, photo_id)
);
CREATE INDEX idx_journey_photos_journey ON journey_photos(journey_id);

-- ============================================================
-- TABLE: journey_entry_photos
-- ============================================================
CREATE TABLE journey_entry_photos (
  entry_id         INTEGER NOT NULL REFERENCES journey_entries(id) ON DELETE CASCADE,
  journey_photo_id INTEGER NOT NULL REFERENCES journey_photos(id) ON DELETE CASCADE,
  sort_order       INTEGER DEFAULT 0,
  created_at       BIGINT NOT NULL,
  PRIMARY KEY(entry_id, journey_photo_id)
);
CREATE INDEX idx_journey_entry_photos_entry ON journey_entry_photos(entry_id);
CREATE INDEX idx_journey_entry_photos_photo ON journey_entry_photos(journey_photo_id);

-- ============================================================
-- TABLE: schema_version
-- ============================================================
CREATE TABLE schema_version (
  id      SERIAL PRIMARY KEY,
  version INTEGER NOT NULL
);

-- ============================================================
-- RLS: Enable Row Level Security on all tables
-- Using permissive policies since auth is handled externally
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE days ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_item_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_category_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_plan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_user_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_user_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacay_holiday_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_category_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_bag_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE visited_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bucket_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_provider_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_album_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_category_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visited_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_day_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE trek_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notice_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_place_photo_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_details_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE trek_photo_cache_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_entry_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_version ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: Allow service_role full access (backend uses service key)
-- All backend requests use service_role key which bypasses RLS by default
-- These policies allow anon/authenticated reads for public data if needed
-- ============================================================

-- Allow service_role to bypass RLS entirely (Supabase default for service_role)
-- No additional policies needed for server-side access with service_role key

-- Grant usage on sequences for SERIAL columns
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
