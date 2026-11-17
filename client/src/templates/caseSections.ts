export type FormSection = {
    key: string
    title: string
    templateKeys: string[]
  }
  
  export const formSections: FormSection[] = [
    { key: 'general', title: 'General information', templateKeys: ['generalInformation'] },
    { key: 'outcomes', title: 'Learning outcomes and objectives', templateKeys: ['learningOutcomes'] },
    { key: 'chart', title: 'Patient chart', templateKeys: ['patientChart'] },
    { key: 'orders', title: 'Orders and medications', templateKeys: ['orders'] },
    {
      key: 'simOps',
      title: 'Simulation operations',
      templateKeys: [
        'patientDetails',
        'settingEnvironment',
        'equipmentSupplies',
        'simMedications',
        'initialSoftwareSetup',
      ],
    },
    { key: 'roles', title: 'Roles', templateKeys: ['roles'] },
    { key: 'prebriefing', title: 'Prebriefing', templateKeys: ['prebriefingPreparation', 'prebriefingGuide'] },
    { key: 'scenario', title: 'Scenario progression', templateKeys: ['scenarioProgression'] },
    { key: 'debriefing', title: 'Debriefing', templateKeys: ['debriefing'] },
    { key: 'evaluation', title: 'Evaluation', templateKeys: ['evaluation', 'spScript'] },
  ]
  
  // Only the title is required. The message names the section and the field.

  export function titleProblem(title: string): string {
    if (title.trim() === '') {
      return 'General information: Title is required.'
    }
    return ''
  }