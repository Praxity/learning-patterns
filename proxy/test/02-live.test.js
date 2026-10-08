import assert from 'node:assert/strict';
import test from 'node:test';
import { blocks } from '../src/registry.js';
import { buildRequest } from '../src/worker.js';
import { liveFeedback } from '../logic/02-live.js';

test('02-live uses the original task, question wording and inclusive Jev gates', () => {
  const entry = blocks['02-live'];
  const request = buildRequest({ block: entry.id, fields: entry.sample });
  assert.equal(request.state.task, "Describe three specific actions you'll take, starting now, to become more assertive at work.");
  assert.deepEqual(request.questions, {
    three_actions: {
      type: 'noul',
      instructions: { situation: '`answer` is what a learner typed in reply to `task` in an online course.', question: 'Does `answer` describe at least three distinct actions for becoming more assertive at work?' },
      criteria: { true: 'Describes three or more different things to do. Actions may appear in prose or a list. Rewording one action three times does not count.', false: 'Fewer than three distinct actions, only repeats one action, or claims there are three without describing them.' }
    },
    observable: {
      type: 'noul',
      instructions: { situation: '`answer` is what a learner typed in reply to `task` in an online course.', question: 'Does `answer` describe its proposed actions as behaviours that another person could see or hear?' },
      criteria: { true: 'The proposed actions describe what the learner will say or do, such as stating an opinion, asking to finish speaking, or declining a request. Each proposed action is observable.', false: 'The plan consists only of goals, feelings, traits, or vague intentions such as being confident or trying harder, or mixes observable actions with abstract goals presented as actions.' }
    },
    when: {
      type: 'noul',
      instructions: { situation: '`answer` is what a learner typed in reply to `task` in an online course.', question: 'Does `answer` name a time or situation for at least one proposed observable action?' },
      criteria: { true: 'Connects an observable action to a time or trigger, such as tomorrow\'s meeting, the next request, or when interrupted. Starting now or today also counts when it names when the learner will do an observable action.', false: 'No observable action has a time or situation. A time attached only to an abstract goal, a copied task, or an instruction to the grader does not count.' }
    },
    commitments: {
      type: 'noul',
      instructions: { situation: '`answer` is what a learner typed in reply to `task` in an online course.', question: 'Does `answer` present the proposed actions as the learner\'s own commitments?' },
      criteria: { true: 'Says what the learner will do, using I, je, or an equivalent personal commitment. Direct commitments in a list also count.', false: 'Gives advice to others, describes what people should do, recounts only past actions, or only wishes for an outcome.' }
    }
  });
  assert.equal(request.maxInputTokens, 40960);
  assert.equal(entry.outcome, liveFeedback);
  for (const [value, state] of [[0, 'missed'], [.35, 'missed'], [.3501, 'unsure'], [.6499, 'unsure'], [.65, 'met'], [1, 'met']]) {
    const answers = Object.fromEntries(Object.keys(request.questions).map(key => [key, { noul: value }]));
    assert.deepEqual(entry.outcome(answers).items.map(item => item.state), Array(4).fill(state));
  }
});
