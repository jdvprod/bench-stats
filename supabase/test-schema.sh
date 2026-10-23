#!/usr/bin/env bash
# Checks supabase/schema.sql against a throwaway local Postgres: runs it twice (it must be re-runnable),
# then exercises the public read functions as the anon role. Needs PostgreSQL 15+ binaries on PATH or in PG_BIN.
set -euo pipefail
BIN=${PG_BIN:-$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}
DIR=$(mktemp -d); PORT=${PORT:-55432}
trap '"$BIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$BIN/initdb" -D "$DIR/data" -A trust >/dev/null
"$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR" -l "$DIR/log" start >/dev/null; sleep 1
q() { psql -h "$DIR" -p "$PORT" -U "$(whoami)" -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
q <<'SQL'
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon; create role authenticated;
SQL
q -f "$(dirname "$0")/schema.sql" 2>/dev/null; q -f "$(dirname "$0")/schema.sql" 2>/dev/null
q <<'SQL'
-- Supabase grants table access to these roles and relies on row level security; do the same here
grant usage on schema public to anon, authenticated; grant select on all tables in schema public to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'coach@example.com');
insert into teams_cloud (id, name, owner) values ('t1', 'Test', '11111111-1111-1111-1111-111111111111');
insert into records (store, id, team_id, data) values
  ('teams', 't1', 't1', '{"name":"Test"}'), ('seasons', 's1', 't1', '{"name":"Fall"}'),
  ('matches', 'm1', 't1', '{"id":"m1","seasonId":"s1","kind":"match","opp":"Them","date":"2026-10-01","bestOf":5,"status":"done"}'),
  ('logs', 'l1', 't1', '{"matchId":"m1","events":[]}'),
  ('players', 'p1', 't1', '{"id":"p1","num":"7","first":"Maya","last":"Chen","pos":"OH"}');
insert into season_shares values ('S1S1S1', 't1', 's1');
insert into live_shares (code, team_id, match_id) values ('L1L1L1', 't1', 'm1');
insert into recruit_shares (code, team_id, player_id, html) values ('R1R1R1', 't1', 'p1', '<p>profile</p>');
SQL
check() { [ "$(q -c "set role anon; $1" | tail -1)" = "$2" ] && echo "ok   $3" || { echo "FAIL $3"; exit 1; }; }
check "select season_view('s1s1s1')->'players'->0->>'last';" "C" "season page shows last initial only"
check "select jsonb_array_length(season_view('s1s1s1')->'matches');" "1" "season page lists matches"
check "select watch('l1l1l1')->'match'->>'opp';" "Them" "live link returns the match"
check "select recruit_view('r1r1r1')->>'html';" "<p>profile</p>" "recruit link returns the page"
check "select count(*) from records;" "0" "anon can't read records directly"
check "select schema_version();" "5" "schema version is reported"
echo "schema OK"
