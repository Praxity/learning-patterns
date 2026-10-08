import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRequest } from '../src/worker.js';
import { blocks } from '../src/registry.js';
import { perplexity, perplexityRequest } from '../src/perplexity.js';
import { readAnswers } from '../src/answers.js';
import { lookup } from '../../patterns/course-lookup/logic.js';

for (const [id, file] of [['20-faq','en.json'],['21-sections','en-sections.json']]) {
  test(`${id} questions and catalogue are server-owned, bounded and unchanged by caller fields`, async t => {
    const content = JSON.parse(await readFile(new URL(`../../patterns/course-lookup/examples/${file}`,import.meta.url)));
    const request=buildRequest({block:id,fields:{question:'How do I say no to more work?'}});
    assert.equal(request.error,undefined);
    assert.equal(request.maxInputTokens,8192);
    assert.deepEqual(Object.keys(request.questions),['lookup']);
    assert.deepEqual(Object.keys(request.questions.lookup.criteria),[...content.entries.map(entry=>entry.id),'none']);
    for(const entry of content.entries) {
      const authored=request.questions.lookup.criteria[entry.id];
      assert.equal(authored,`${entry.title}${content.kind==='faq'?'':'.'} ${entry.answer ?? entry.summary}`);
    }
    for(const body of [
      {block:id,fields:{question:'x',catalogue:'replace'}},
      {block:id,fields:{question:'x',kind:'faq'}},
      {block:id,fields:{question:'x'},questions:{lookup:{}}},
      {block:id,fields:{}}, {block:id,fields:{question:'x'.repeat(501)}}
    ]) assert.equal(typeof buildRequest(body).error,'string');
    const choice=content.entries[0].id;
    const probabilities=Object.fromEntries(Object.keys(request.questions.lookup.criteria).map(option=>[option,option===choice?.9:option==='none'?.1:0]));
    t.mock.method(globalThis,'fetch',async(url,options)=>{
      assert.equal(url,'https://api.perplexity.ai/v1/decisions');
      assert.deepEqual(JSON.parse(options.body),perplexityRequest(request.state,request.questions));
      return Response.json({model:'pplx-decider-v1.1-27b',answers:{lookup:{type:'choice',choice,confidence:.9,probabilities}},usage:{input_tokens:1200}});
    });
    const result=await perplexity('test-key',request.state,request.questions);
    const answers=readAnswers(result.answers,request.questions);
    assert.deepEqual(blocks[id].outcome(answers).ids,lookup(content,answers).map(entry=>entry.id));
    const wire=perplexityRequest(buildRequest({block:id,fields:{question:'\u0000'.repeat(500)}}).state,request.questions);
    const bytes=Buffer.byteLength(JSON.stringify(wire))+1024;
    assert.ok(bytes<=8192,`${id}: ${bytes}`);
  });
}
