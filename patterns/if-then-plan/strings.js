// Option text completes whenStem and willStem, so the four sentence strings must stay in step:
// soFar is the plan up to the action, and plan is the whole sentence.
export const strings = {
  en: {
    whenStem: 'When…', willStem: 'I will…',
    soFar: 'When {when}, I will…', plan: 'When {when}, I will {will}.',
    whenHint: 'Choose a moment you will notice when it happens.',
    willHint: 'Choose something another person could see or hear you do.',
    add: 'Add to my plan',
    chooseWhen: 'Choose a moment first.', chooseWill: 'Choose an action first.',
    markVague: 'Too vague', vagueStatus: 'Too vague. {reason}',
    planLabel: 'Your plan',
    dateHint: 'Set a date and time. The calendar entry shows your plan {minutes}\u00a0minutes before.',
    past: 'That time has passed. Choose a later one.',
    calendar: 'Add to calendar',
    downloaded: 'Calendar file downloaded. Open it to add your plan to your calendar.',
    fileName: 'if-then-plan.ics',
    eventNote: 'You made this plan in "{title}".',
    restart: 'Start over', cleared: 'Started over.',
    vagueOptions: 'Why some options are too vague',
    noScript: 'Choose one moment and one action, then write your plan in your calendar as one sentence. Making a calendar file needs JavaScript.'
  },
  fr: {
    whenStem: 'Quand…', willStem: 'Je vais…',
    soFar: 'Quand {when}, je vais…', plan: 'Quand {when}, je vais {will}.',
    whenHint: 'Choisissez un moment que vous remarquerez quand il se produira.',
    willHint: 'Choisissez une action qu’une autre personne pourrait vous voir ou vous entendre faire.',
    add: 'Ajouter à mon plan',
    chooseWhen: 'Choisissez d’abord un moment.', chooseWill: 'Choisissez d’abord une action.',
    markVague: 'Trop vague', vagueStatus: 'Trop vague. {reason}',
    planLabel: 'Votre plan',
    dateHint: 'Indiquez une date et une heure. L’entrée de calendrier affichera votre plan {minutes}\u00a0minutes avant.',
    past: 'Ce moment est déjà passé. Choisissez une date à venir.',
    calendar: 'Ajouter au calendrier',
    downloaded: 'Fichier de calendrier téléchargé. Ouvrez-le pour ajouter votre plan à votre calendrier.',
    fileName: 'plan-si-alors.ics',
    eventNote: 'Vous avez fait ce plan dans l’activité « {title} ».',
    restart: 'Recommencer', cleared: 'Vous avez recommencé.',
    vagueOptions: 'Pourquoi certaines options sont trop vagues',
    noScript: 'Choisissez un moment et une action, puis écrivez votre plan dans votre calendrier en une seule phrase. JavaScript est nécessaire pour créer un fichier de calendrier.'
  }
};
/** @typedef {typeof strings.en} Strings */
