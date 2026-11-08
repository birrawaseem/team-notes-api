TRUNCATE notes, team_members, teams, users RESTART IDENTITY CASCADE;

INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob',   'bob@example.com'),
  ('Carol', 'carol@example.com');

INSERT INTO teams (name) VALUES
  ('Engineering'),
  ('Design');

-- Alice: Engineering + Design, Bob: Engineering, Carol: Design
INSERT INTO team_members (team_id, user_id) VALUES
  (1, 1), (1, 2),
  (2, 1), (2, 3);

INSERT INTO notes (team_id, author_id, title, body) VALUES
  (1, 1, 'Sprint planning', 'Goals for this sprint...'),
  (1, 2, 'API ideas', 'Should we add search?'),
  (2, 3, 'Color palette', 'Draft colors for the new theme.');