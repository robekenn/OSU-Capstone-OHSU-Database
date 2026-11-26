-- Campuses
INSERT INTO campus (name)
SELECT 'Portland'
WHERE NOT EXISTS (SELECT 1 FROM campus WHERE name = 'Portland');

-- Courses (titles left empty until the partners confirm them)
INSERT INTO course (code, title)
SELECT 'NRS 424', NULL
WHERE NOT EXISTS (SELECT 1 FROM course WHERE code = 'NRS 424');

INSERT INTO course (code, title)
SELECT 'NRS 425', NULL
WHERE NOT EXISTS (SELECT 1 FROM course WHERE code = 'NRS 425');

INSERT INTO course (code, title)
SELECT 'NRS 435', NULL
WHERE NOT EXISTS (SELECT 1 FROM course WHERE code = 'NRS 435');

-- Outcomes: the four IPEC interprofessional competencies
INSERT INTO outcome (framework, outcome_type, code, description)
SELECT 'IPEC', 'competency', NULL, 'Values and Ethics'
WHERE NOT EXISTS (
  SELECT 1 FROM outcome WHERE framework = 'IPEC' AND description = 'Values and Ethics'
);

INSERT INTO outcome (framework, outcome_type, code, description)
SELECT 'IPEC', 'competency', NULL, 'Roles and Responsibilities'
WHERE NOT EXISTS (
  SELECT 1 FROM outcome WHERE framework = 'IPEC' AND description = 'Roles and Responsibilities'
);

INSERT INTO outcome (framework, outcome_type, code, description)
SELECT 'IPEC', 'competency', NULL, 'Communication'
WHERE NOT EXISTS (
  SELECT 1 FROM outcome WHERE framework = 'IPEC' AND description = 'Communication'
);

INSERT INTO outcome (framework, outcome_type, code, description)
SELECT 'IPEC', 'competency', NULL, 'Teams and Teamwork'
WHERE NOT EXISTS (
  SELECT 1 FROM outcome WHERE framework = 'IPEC' AND description = 'Teams and Teamwork'
);