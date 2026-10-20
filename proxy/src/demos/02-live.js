import { criterion } from "../shared.js";
import { ANSWER_LIMIT } from "../../logic/02-live.js";

export const TASK = "Describe three specific actions you'll take, starting now, to become more assertive at work.";

export default {
	id: "02-live",
	fields: { answer: ANSWER_LIMIT },
	sample: { answer: "In tomorrow's team meeting, I'll state my view before the decision. When someone interrupts me, I'll ask to finish my point. If a new request exceeds my workload, I'll explain my limit and offer a realistic deadline." },
	build: ({ answer }) => ({
		state: { task: TASK, answer },
		questions: {
			three_actions: criterion("describe at least three distinct actions for becoming more assertive at work", "Describes three or more different things to do. Actions may appear in prose or a list. Rewording one action three times does not count.", "Fewer than three distinct actions, only repeats one action, or claims there are three without describing them."),
			observable: criterion("describe its proposed actions as behaviours that another person could see or hear", "The proposed actions describe what the learner will say or do, such as stating an opinion, asking to finish speaking, or declining a request. Each proposed action is observable.", "The plan consists only of goals, feelings, traits, or vague intentions such as being confident or trying harder, or mixes observable actions with abstract goals presented as actions."),
			when: criterion("name a time or situation for at least one proposed observable action", "Connects an observable action to a time or trigger, such as tomorrow's meeting, the next request, or when interrupted. Starting now or today also counts when it names when the learner will do an observable action.", "No observable action has a time or situation. A time attached only to an abstract goal, a copied task, or an instruction to the grader does not count."),
			commitments: criterion("present the proposed actions as the learner's own commitments", "Says what the learner will do, using I, je, or an equivalent personal commitment. Direct commitments in a list also count.", "Gives advice to others, describes what people should do, recounts only past actions, or only wishes for an outcome."),
		},
	}),
};
