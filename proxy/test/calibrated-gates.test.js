import test from "node:test";
import assert from "node:assert/strict";
import { readBranch } from "../logic/03-branch.js";
import { misconceptionFeedback } from "../logic/06-misconceptions.js";
import { labelAnswers } from "../logic/16-fixture-data.js";
const model = "@cf/cloudflare/clef";

test('27B branch gate accepts a clear hedge while keeping the known injected reply out',()=>{
 assert.equal(readBranch({choice:'acknowledge',confidence:0.6},undefined,model),'acknowledge');
 assert.equal(readBranch({choice:'attack',confidence:0.5538},undefined,model),null);
 assert.equal(readBranch({choice:'acknowledge',confidence:0.5999},undefined,model),null);
 assert.equal(readBranch({choice:'off_script',confidence:1},undefined,model),null);
 assert.equal(readBranch({choice:'acknowledge',confidence:0.6},undefined,'@cf/cloudflare/clef-flash'),null);
});


test('27B study belief boundary hedges below the calibrated gate', () => {
 assert.equal(misconceptionFeedback({choice:'correct',confidence:0.25},model).sure,true);
 assert.equal(misconceptionFeedback({choice:'correct',confidence:0.2499},model).sure,false);
 assert.equal(misconceptionFeedback({choice:'none',confidence:0.25},model).log,true);
 for (const other of [undefined,'jev-1.13.0','@cf/cloudflare/clef-flash']) assert.equal(misconceptionFeedback({choice:'correct',confidence:0.25},other).sure,false);
});
test('27B fixture calibration preserves inclusive positive and negative boundaries', () => {
 const a = Object.fromEntries(['work_deadline','reason','new_date','impact','agreement','blame'].map(key => [key,{noul:0}]));
 a.work_deadline.noul = 0.625; a.agreement.noul = 0.6;
 assert.equal(labelAnswers(a,model).work_deadline,'met');
 assert.equal(labelAnswers(a,model).agreement,'met');
 assert.equal(labelAnswers({...a,work_deadline:{noul:0.6249}},model).work_deadline,'unsure');
 assert.equal(labelAnswers({...a,agreement:{noul:0.5999}},model).agreement,'unsure');
 assert.equal(labelAnswers({...a,work_deadline:{noul:0.375}},model).work_deadline,'missed');
 assert.equal(labelAnswers({...a,agreement:{noul:0.4}},model).agreement,'missed');
 for (const other of [undefined,'jev-1.13.0','@cf/cloudflare/clef-flash']) {
  assert.equal(labelAnswers(a,other).work_deadline,'unsure');
  assert.equal(labelAnswers(a,other).agreement,'unsure');
 }
});
