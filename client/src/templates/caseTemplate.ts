// The case form is built from this file. To add, rename, or reorder a field, edit it here.
// Names come from the OHSU Simulation Design Template (structure only, no case content).

export type Column = { key: string; label: string; multiline?: boolean }

export type Field =
  | { kind: 'text'; key: string; label: string; help?: string }
  | { kind: 'textarea'; key: string; label: string; help?: string }
  | { kind: 'checkboxes'; key: string; label: string; options: string[]; hasOther?: boolean }
  | { kind: 'radio'; key: string; label: string; options: string[] }
  | { kind: 'list'; key: string; label: string; itemLabel: string; help?: string }
  | { kind: 'table'; key: string; label: string; columns: Column[]; help?: string }

export type Section = {
  key: string
  title: string
  optional?: boolean
  fields: Field[]
}

// What each kind of field stores in the saved JSON:
//   text, textarea, radio -> string
//   checkboxes            -> string[]  (the "Other" text is saved in <key>Other as a string)
//   list                  -> string[]
//   table                 -> array of rows, each row is { columnKey: string }
export type TableRow = Record<string, string>
export type FieldValue = string | string[] | TableRow[]
export type CaseContent = Record<string, Record<string, FieldValue>>

// Small helpers so each field below is one line.
function text(key: string, label: string, help?: string): Field {
  return { kind: 'text', key, label, help }
}
function area(key: string, label: string, help?: string): Field {
  return { kind: 'textarea', key, label, help }
}
function checks(key: string, label: string, options: string[], hasOther = false): Field {
  return { kind: 'checkboxes', key, label, options, hasOther }
}
function radio(key: string, label: string, options: string[]): Field {
  return { kind: 'radio', key, label, options }
}
function list(key: string, label: string, itemLabel: string, help?: string): Field {
  return { kind: 'list', key, label, itemLabel, help }
}
function table(key: string, label: string, columns: Column[], help?: string): Field {
  return { kind: 'table', key, label, columns, help }
}
function col(key: string, label: string, multiline = false): Column {
  return { key, label, multiline }
}

// Column sets used more than once.
const drugColumns = [
  col('name', 'Name'),
  col('dose', 'Dose'),
  col('route', 'Route'),
  col('time', 'Time'),
  col('indication', 'Indication'),
]

export const caseTemplate: Section[] = [
  {
    key: 'generalInformation',
    title: 'General Information',
    fields: [
      text('campus', 'Campus'),
      text('discipline', 'Discipline'),
      text('program', 'Program'),
      text('course', 'Course'),
      text('learningEnvironment', 'Learning Environment', 'Sim Center, Skills Lab, Classroom, Virtual'),
      text('simModality', 'Sim Modality', 'Manikin, SP, Mixed, Virtual'),
      text('prebriefingMinutes', 'Sim Time: Prebriefing (minutes)'),
      text('scenarioMinutes', 'Sim Time: Scenario (minutes)'),
      text('debriefingMinutes', 'Sim Time: Debriefing (minutes)'),
    ],
  },
  {
    key: 'learningOutcomes',
    title: 'Learning Outcomes & Objectives',
    fields: [
      list('outcomes', 'Outcomes', 'Outcome', 'Broader competencies learners should be able to demonstrate because of the simulation.'),
      list('objectives', 'Objectives', 'Objective', 'Specific, measurable actions learners will demonstrate during the simulation.'),
    ],
  },
  {
    key: 'patientChart',
    title: 'Patient Chart',
    fields: [
      text('patientName', 'Patient Name', 'Use a fictional name only.'),
      text('dob', 'DOB', 'Use a fictional date only.'),
      text('allergies', 'Allergies'),
      text('height', 'Height'),
      text('weight', 'Weight'),
      text('medicalDiagnosis', 'Medical Diagnosis'),
      text('attendingProvider', 'Attending Provider'),
      area('historyOfPresentIllness', 'History of Present Illness', 'Why does the patient need care today?'),
      area('pastMedicalSurgicalHistory', 'Past Medical/Surgical History'),
      area('socialHistory', 'Social History', 'Describe only necessary information.'),
      table('homeMedications', 'Home Medications', drugColumns),
    ],
  },
  {
    key: 'orders',
    title: 'Orders',
    fields: [
      text('codeStatus', 'Code Status'),
      text('diet', 'Diet'),
      text('activity', 'Activity'),
      list('nursingOrders', 'Nursing Orders', 'Nursing order'),
      list('labs', 'Labs', 'Lab'),
      table('medications', 'Medications', drugColumns),
      area('callParameters', 'Call Parameters'),
    ],
  },
  {
    key: 'patientDetails',
    title: 'Simulation Operations: Patient Details',
    fields: [
      checks('type', 'Type', ['Manikin', 'SP', 'Embedded Participant']),
      text('manikinDetails', 'Manikin: size and fidelity', 'Size (Infant, Pediatric, Adult); Fidelity (Low, Moderate, High)'),
      text('spDetails', 'SP: demographics', 'Age, gender/sex, etc.'),
      text('embeddedParticipantDetails', 'Embedded Participant: role and demographics'),
      area('moulage', 'Moulage', 'Describe injuries (wounds, rashes, bruises, etc.).'),
      area('characterNotes', 'Character Notes', 'Key physical characteristics (dress, affect, hygiene, etc.).'),
    ],
  },
  {
    key: 'settingEnvironment',
    title: 'Simulation Operations: Setting/Environment',
    fields: [
      checks(
        'room',
        'Room',
        [
          'Emergency Room', 'Medical-Surgical Unit', 'Pediatric Unit', 'Labor/Delivery Unit',
          'Behavioral Health Unit', 'ICU', 'OR / PACU', 'Rehabilitation Unit', 'Home', 'Outpatient Clinic',
        ],
        true,
      ),
      text('bedType', 'Bed Type', 'Hospital Bed, Exam Table, Stretcher, etc.'),
      checks(
        'props',
        'Props',
        ['Bedside Table', 'Bedside Chair', 'Incentive Spirometer', 'Cell Phone', 'Meal Tray'],
        true,
      ),
      area('settingNotes', 'Setting/Environment Notes'),
    ],
  },
  {
    key: 'equipmentSupplies',
    title: 'Simulation Operations: Equipment/Supplies',
    fields: [
      checks(
        'attachedToPatient',
        'Equipment Attached to Patient',
        [
          'ID band', 'IV tubing with primary line fluids', 'Secondary IV line', 'IVPB', 'IV pump',
          'PCA pump', 'Foley catheter', 'O2', 'Monitor attached',
        ],
        true,
      ),
      area('attachedDetails', 'Attached equipment details', 'Fluid type, rates, Foley volume, O2 device and rate, monitor parameters.'),
      checks(
        'availableInRoom',
        'Equipment Available in Room',
        [
          'Bedpan/urinal', 'Foley kit', 'Straight catheter kit', 'O2 delivery device', 'Fluids', 'IV start kit',
          'IV tubing', 'IVPB tubing', 'IV pump', 'Injection Pad', 'Nebulizer Kit', 'Suction',
          'Workstation on Wheels (WOW)',
        ],
        true,
      ),
      checks(
        'specialtyEquipment',
        'Specialty Equipment',
        [
          'Home Health Kit', 'Portable VS Monitor', 'Nasogastric (NG) Tube Kit', 'Wound Care Kit',
          'Suture Removal Kit', 'Pediatric/Infant O2 Devices', 'Pediatric/Infant BP Cuff', 'Crash cart',
          'Defibrillator/pacer', '12 lead EKG', 'Ventriloscope', 'Sequential Compression Device (SCD)',
        ],
        true,
      ),
      area('equipmentNotes', 'Equipment/Supply Notes'),
    ],
  },
  {
    key: 'simMedications',
    title: 'Simulation Operations: Medications',
    fields: [
      table('medications', 'Medications', [
        col('name', 'Name'),
        col('dose', 'Dose'),
        col('concentrate', 'Concentrate'),
        col('route', 'Route'),
        col('rate', 'Rate'),
      ]),
    ],
  },
  {
    key: 'initialSoftwareSetup',
    title: 'Simulation Operations: Initial Software Setup',
    fields: [
      text('hr', 'Heart rate (HR)'),
      text('bp', 'Blood pressure (BP)'),
      text('rr', 'Respiratory rate (RR)'),
      text('o2', 'O2 saturation'),
      text('temp', 'Temperature (T)'),
      checks('waveforms', 'Waveforms', ['ECG', 'ABP', 'CVP', 'EtCO2']),
      text('heart', 'Auscultation: Heart'),
      text('lungs', 'Auscultation: Lungs'),
      text('bowel', 'Auscultation: Bowel'),
      area('miscellaneous', 'Miscellaneous', 'Additional setup needs.'),
    ],
  },
  {
    key: 'roles',
    title: 'Roles',
    fields: [
      checks('participants', 'Participants', [
        'Primary Active Participants', 'Secondary Active Participants', 'Observers', 'Recorder',
      ]),
      text('participantCounts', 'Number of learners per selected role'),
      checks(
        'patientEmbedded',
        'Patient & Embedded Participants',
        ['Manikin Voice', 'SP', 'Family', 'Charge Nurse', 'Provider', 'Other Healthcare Professional(s)'],
        true,
      ),
      checks(
        'educatorsStaff',
        'Educators & Staff',
        ['Lead Facilitator', 'Co-Facilitator', 'Content Expert', 'SimOps Specialist', 'SP Trainer On-Site'],
      ),
      area('guidelines', 'Guidelines & Information', 'Purpose, focus, and key directions for each role selected above.'),
    ],
  },
  {
    key: 'prebriefingPreparation',
    title: 'Prebriefing: Preparation',
    fields: [
      table('requiredSkills', 'Required Skills of Participants', [col('technical', 'Technical'), col('nonTechnical', 'Non-Technical')]),
      list('curricularActivities', 'Associated Curricular Activities', 'Activity', 'What participants already know from theory and/or clinical: readings, videos, podcasts, case studies, discussions, assignments.'),
      list('supportingDocuments', 'Supporting Documents', 'Document', 'Clinical practice guidelines, policies/procedures/protocols, algorithms, tools.'),
    ],
  },
  {
    key: 'prebriefingGuide',
    title: 'Prebriefing: Guide',
    fields: [
      area('welcome', 'Step 1: Welcome message', 'One or two lines to set the tone.'),
      area('goalsStatement', 'Step 1: Goals, objectives, and expectations statement'),
      area('logistics', 'Step 1: Logistics', 'Restrooms, food/drink, PPE, etc.'),
      table('agenda', 'Step 1: Schedule/Agenda', [
        col('agenda', 'Agenda'),
        col('minutes', 'Minutes'),
        col('amTime', 'AM Time'),
        col('pmTime', 'PM Time'),
      ]),
      area('facultyStaffIntroductions', 'Step 2: Faculty and staff to introduce', 'Names and roles, for example Lead Facilitator, Co-Facilitator, SimOps Specialist.'),
      text('iceBreaker', 'Step 2: Ice Breaker (optional)'),
      area('participantRoleAssignments', 'Step 2: Participant role assignments', 'How active participants and observers are assigned, and when learners are told.'),
      area('orientation', 'Step 3: Orientation to Simulation Environment', 'What participants need to know to navigate the environment, equipment, and technology.'),
      area('situation', 'Step 4: Report to start scenario: Situation'),
      area('background', 'Step 4: Report to start scenario: Background'),
      area('assessment', 'Step 4: Report to start scenario: Assessment'),
      area('recommendation', 'Step 4: Report to start scenario: Recommendation'),
    ],
  },
  {
    key: 'scenarioProgression',
    title: 'Scenario Progression Grid',
    fields: [
      table(
        'grid',
        'Progression grid',
        [
          col('time', 'Time'),
          col('initialCues', 'Initial Cues/Narrative', true),
          col('noticingInterpreting', 'Noticing/Interpreting', true),
          col('respondingReflecting', 'Responding/Reflecting', true),
          col('computerResponse', 'Compute/Client Response', true),
        ],
        'One row per time block, for example 0-5 min.',
      ),
      area('scenarioEnds', 'Scenario Ends', 'How the sim concludes and how participants are cued to leave.'),
    ],
  },
  {
    key: 'debriefing',
    title: 'Debriefing Guide',
    fields: [
      text('debriefMinutes', 'Debrief length (minutes)'),
      area('debriefGoal', 'Setting the Scene: goal of the debrief'),
      area('keyLearningPoints', 'Application/Summary: key learning points'),
      area('noticingNotes', 'Clinical judgment: Noticing notes'),
      area('interpretingNotes', 'Clinical judgment: Interpreting notes'),
      area('respondingNotes', 'Clinical judgment: Responding notes'),
      area('reflectingNotes', 'Clinical judgment: Reflecting notes'),
    ],
  },
  {
    key: 'evaluation',
    title: 'Evaluation',
    fields: [
      area('learningAssessment', 'Learning Assessment', 'Who, What, How, Why, and When.'),
      area('perspective1', 'Simulation Quality & Effectiveness: Perspective #1'),
      area('perspective2', 'Simulation Quality & Effectiveness: Perspective #2'),
    ],
  },
  {
    key: 'spScript',
    title: 'HiFi SP Case Script (use if necessary)',
    optional: true,
    fields: [
      text('caseTitle', 'Case Title'),
      text('roleNames', 'Role Name(s)'),
      text('event', 'Event'),
      text('authors', 'Author(s)'),
      text('dateOfRevision', 'Date of Revision'),
      area('briefDescription', 'Brief description of sim in layman’s terms'),
      checks('scriptIsFor', 'This script is for', ['Patient', 'Parent', 'Spouse', 'Caregiver (not Parent or Spouse)', 'Family member/Friend']),
      list('learningObjectives', 'Learning Objectives', 'Objective', 'In order of importance.'),
      area('likelyActions', 'What actions will the learner likely take'),
      table('likelyQuestions', 'What questions will the learner(s) likely ask', [
        col('question', 'Question'),
        col('answer', 'Answer (or mark as SP)'),
      ]),
      area('assessmentTools', 'Assessment tool(s) the learner is likely to use'),
      area('patientStory', 'Patient Story'),
      area('currentConcern', 'Current concern or CC'),
      area('spHistoryOfPresentIllness', 'History of Present Illness/Circumstances'),
      area('medicalHistory', 'Medical History'),
      area('characterFamilyBackground', 'Necessary Character/Family background'),
      area('patientQuestions', 'Patient’s Questions + Additional Concerns'),
      area('familyQuestions', 'Family member’s Questions + Additional Concerns'),
      area('encounterDirection', 'Sim Encounter Direction'),
      area('reportToLearner', 'Report to Learner'),
      area('optionalAdditions', 'Optional Additions'),
      radio('comfortWithObjectives', 'How comfortable should the learner be with their goals/objectives', ['Expert', 'Very comfortable', 'Somewhat comfortable', 'Novice']),
      radio('comfortWithSimulation', 'How comfortable are learners with simulation as a learning tool', ['Very', 'Somewhat', 'Novice']),
      radio('spConcern', 'SP’s level of concern/emotional intensity', ['Very concerned/high emotion', 'Mildly concerned/agitated', 'Not concerned/relaxed']),
      radio('spCooperation', 'How cooperative should the SP be', ['Very cooperative, no matter what', 'Cooperative if their questions/concerns are addressed', 'Not cooperative, no matter what']),
      radio('spInformation', 'How giving should the SP be with information', ['Open book: relay information whether asked or not', 'Give information freely when asked', 'Be reluctant, but provide information when asked directly']),
      text('openingLine', 'Opening Line'),
      area('spCharacterNotes', 'Character Notes', 'Demeanor, motivation, expectations, etc.'),
      area('knowledgeOfIllness', 'How knowledgeable is the Patient/Family on the illness or condition'),
      area('responseToActions', 'Response to learners’ actions'),
      area('ifThen', 'If/Then', 'How to respond to less desired actions and potential safety concerns.'),
      area('manikinPrompts', 'Manikin Prompts'),
      area('propsTaskTrainer', 'Props + Task Trainer notes'),
      area('spDecideTogether', 'Information SPs should decide together'),
      area('planToEnd', 'Plan to end scenario'),
    ],
  },
]