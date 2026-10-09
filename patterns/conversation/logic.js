import { BRANCHES, ROUNDS, REPLY_LIMIT, confidenceGate } from '../../proxy/logic/03-contract.js';
export { BRANCHES, REPLY_LIMIT };

/** @typedef {'acknowledge' | 'defend' | 'attack' | 'withdraw' | 'pause'} Branch */
/** @typedef {Record<Branch, string>} Replies */
/** @typedef {{ line: string, endings: Replies, move: string, debrief: string }} BranchContent */
/** @typedef {{ setup: string, person: { name: string, role: string, initial: string }, opening: string, branches: Record<Branch, BranchContent>, examples: Record<'opening' | Branch, Replies>, stageNotes: Record<string, string>, pauseNote: string, unsure: string, offScript: string }} Content */
/** @typedef {{ branch: Branch, reply: string }} Move */
/** @typedef {{ node: 'opening' | Branch, round: number, history: Move[], end: boolean }} ConversationState */
/** @typedef {{ conversation: ConversationState, draft: string }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {unknown} value @param {string[]} keys @param {string} path @returns {asserts value is Record<string, unknown>} */
function fields(value, keys, path) {
  if (!object(value)) throw new Error(`Invalid ${path}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new Error(`Invalid ${path}.${key}`);
}
/** @param {unknown} value @param {string} path */
function text(value, path) { if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${path}`); }
/** @param {unknown} value @param {string[]} keys @param {string} path */
function texts(value, keys, path) {
  fields(value, keys, path);
  for (const key of keys) text(value[key], `${path}.${key}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  fields(content, ['setup', 'person', 'opening', 'branches', 'examples', 'stageNotes', 'pauseNote', 'unsure', 'offScript'], 'content');
  for (const key of ['setup', 'opening', 'pauseNote', 'unsure', 'offScript']) text(content[key], `content.${key}`);
  texts(content.person, ['name', 'role', 'initial'], 'person');
  fields(content.branches, BRANCHES, 'branches');
  for (const branch of BRANCHES) {
    const value = content.branches[branch];
    fields(value, ['line', 'endings', 'move', 'debrief'], `branches.${branch}`);
    for (const key of ['line', 'move', 'debrief']) text(value[key], `branches.${branch}.${key}`);
    texts(value.endings, BRANCHES, `branches.${branch}.endings`);
  }
  fields(content.examples, ['opening', ...BRANCHES], 'examples');
  for (const node of ['opening', ...BRANCHES]) {
    texts(content.examples[node], BRANCHES, `examples.${node}`);
    for (const branch of BRANCHES) if (String(/** @type {Record<string, unknown>} */ (content.examples[node])[branch]).length > REPLY_LIMIT) throw new Error(`Invalid examples.${node}.${branch}`);
  }
  if (!object(content.stageNotes)) throw new Error('Invalid stageNotes');
  for (const [path, note] of Object.entries(content.stageNotes)) {
    if (!BRANCHES.some(first => BRANCHES.some(second => path === `${first}:${second}`))) throw new Error(`Invalid stageNotes.${path}`);
    text(note, `stageNotes.${path}`);
  }
}

/** @param {unknown} answers @param {string} [model] @returns {Branch | 'unsure' | 'off_script'} */
export function feedback(answers, model = '') {
  if (!object(answers) || !object(answers.branch)) throw new Error('Invalid answers.branch');
  const { choice, confidence } = answers.branch;
  if (typeof choice !== 'string' || ![...BRANCHES, 'off_script'].includes(choice)) throw new Error('Invalid answers.branch.choice');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Invalid answers.branch.confidence');
  if (choice === 'off_script') return choice;
  return confidence >= confidenceGate(model) ? /** @type {Branch} */ (choice) : 'unsure';
}

/** Restore only a coherent two-round conversation. @param {unknown} value @returns {LearnerState | null} */
export function validateState(value) {
  if (!object(value) || typeof value.draft !== 'string' || value.draft.length > REPLY_LIMIT || !object(value.conversation)) return null;
  const saved = value.conversation;
  if (!Array.isArray(saved.history) || saved.history.length > ROUNDS) return null;
  /** @type {Move[]} */
  const history = [];
  for (const move of saved.history) {
    if (!object(move) || typeof move.branch !== 'string' || !BRANCHES.includes(move.branch) || typeof move.reply !== 'string' || !move.reply.trim() || move.reply.length > REPLY_LIMIT) return null;
    history.push({ branch: /** @type {Branch} */ (move.branch), reply: move.reply });
  }
  const node = history.at(-1)?.branch ?? 'opening';
  if (saved.node !== node || saved.round !== history.length || saved.end !== (history.length === ROUNDS)) return null;
  return { draft: value.draft, conversation: { node, round: history.length, history, end: history.length === ROUNDS } };
}

/** @returns {ConversationState} */
export function start() { return { node: 'opening', round: 0, history: [], end: false }; }

/** @param {Content} content @param {ConversationState} state @param {Branch | 'unsure' | 'off_script'} branch @param {string} reply */
export function turn(content, state, branch, reply) {
  if (state.end) throw new Error('Conversation already ended');
  if (branch === 'unsure' || branch === 'off_script') return { state, line: '', note: branch === 'unsure' ? content.unsure : content.offScript };
  if (!BRANCHES.includes(branch)) throw new Error('Invalid branch');
  if (typeof reply !== 'string' || !reply.trim() || reply.length > REPLY_LIMIT) throw new Error('Invalid reply');
  const history = [...state.history, { branch, reply }];
  const end = history.length === ROUNDS;
  return {
    state: { node: branch, round: history.length, history, end },
    line: state.round === 0 ? content.branches[branch].line : content.branches[/** @type {Branch} */ (state.node)].endings[branch],
    note: end ? content.stageNotes[`${state.node}:${branch}`] ?? '' : branch === 'pause' ? content.pauseNote : ''
  };
}
