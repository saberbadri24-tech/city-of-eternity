import assert from 'node:assert/strict';
import {buildComplementaryCouncil} from '../functions/api/anil-team-council.mjs';
import {fallbackModels} from '../functions/api/anil-super-team.mjs';

assert.deepEqual(fallbackModels.astra,['gpt-6-astra','gpt-6.1-sol','gpt-6-luna','gpt-5.6-luna']);
assert.deepEqual(fallbackModels.claude,['claude-opus-5','claude-sonnet-5','claude-sonnet-4-6']);
assert.deepEqual(fallbackModels.gemini,['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash']);
assert.ok(!fallbackModels.claude.some(x=>/claude-3-7|claude-3-5-haiku/.test(x)),'retired Claude model IDs must not be fallback targets');
assert.ok(!fallbackModels.gemini.includes('gemini-2.0-flash'),'shut-down Gemini 2.0 must not be a fallback target');
assert.ok(!fallbackModels.astra.some(x=>/^gpt-5(?:-|$)/.test(x)),'legacy GPT-5 should not outrank current GPT-6 fallbacks');
const roles=[{"id":"anil","name":"ANIL"},{"id":"astra","name":"Astra"},{"id":"claude","name":"Claude"},{"id":"gemini","name":"Gemini"},{"id":"guard","name":"Guard"},{"id":"revenue","name":"Revenue Fleet"},{"id":"qa","name":"QA Sentinel"},{"id":"memory","name":"Memory & Learning Engine"},{"id":"architect","name":"Systems Architect"},{"id":"performance","name":"Performance Sentinel"},{"id":"incident","name":"Incident Commander"},{"id":"product","name":"Product & UX Engine"},{"id":"research","name":"Market Research Engine"},{"id":"data","name":"Data Integrity Auditor"},{"id":"redteam","name":"Red-Team Challenger"},{"id":"delivery","name":"Delivery & Release Manager"},{"id":"cost","name":"Cost & Quota Optimizer"},{"id":"observability","name":"Observability Engine"}];
const emptyProviders={astra:{live:false},claude:{live:false},gemini:{live:false}};
const stale=buildComplementaryCouncil({task:'improve site',guard:null,providers:emptyProviders,command:{priorities:[],stopConditions:[],blockers:[]},evidence:{guardAvailable:false,liveProviders:[]},roles});
assert.equal(stale.team.length,18,'all specialist roles must be present');
assert.equal(new Set(stale.team.map(x=>x.id)).size,18,'specialist IDs must be unique');
assert.ok(stale.team.every(x=>x.assignment),'every specialist must have a defined assignment');
assert.equal(stale.qualityGates.find(x=>x.id==='guard-freshness').pass,false,'missing Guard evidence must fail closed');
assert.equal(stale.qualityGates.find(x=>x.id==='evidence').pass,false,'empty runtime evidence must not pass');
assert.equal(stale.qualityGates.find(x=>x.id==='release-proof').pass,false,'release gate must never self-approve');
assert.ok(stale.command.blockers.some(x=>x.includes('stale')),'stale Guard must be surfaced as a blocker');
assert.ok(stale.command.blockers.some(x=>x.includes('Fewer than two')),'insufficient independent models must be surfaced');

const fresh=buildComplementaryCouncil({task:'review opportunity',guard:{freshness:{stale:false}},providers:{astra:{live:true},claude:{live:true},gemini:{live:false}},command:{priorities:[],stopConditions:[],blockers:[]},evidence:{guardAvailable:true,guardFresh:true,liveProviders:['astra','claude']},roles});
assert.equal(fresh.qualityGates.find(x=>x.id==='guard-freshness').pass,true,'fresh Guard evidence should pass freshness gate');
assert.equal(fresh.qualityGates.find(x=>x.id==='evidence').pass,true,'runtime evidence should be recognized');
assert.equal(fresh.qualityGates.find(x=>x.id==='independent-review').pass,true,'two live specialist providers satisfy review gate');

const sensitive=buildComplementaryCouncil({task:'deploy production and transfer payment',guard:{freshness:{stale:false}},providers:emptyProviders,command:{priorities:[],stopConditions:[],blockers:[]},evidence:{guardAvailable:true,liveProviders:[]},roles});
assert.equal(sensitive.qualityGates.find(x=>x.id==='security-owner-gate').pass,false,'sensitive actions must require owner approval');
assert.equal(sensitive.qualityGates.find(x=>x.id==='security-owner-gate').status,'approval_required');
assert.ok(sensitive.command.blockers.some(x=>x.includes('explicit owner approval')),'sensitive action blocker must be explicit');
assert.equal(sensitive.command.sensitiveTask,true);
const malformedCommand=buildComplementaryCouncil({task:'improve site',guard:{freshness:{stale:false}},providers:emptyProviders,command:{priorities:'high',stopConditions:'manual',blockers:'existing'},evidence:{guardAvailable:true,liveProviders:[]},roles});
assert.ok(Array.isArray(malformedCommand.command.priorities),'string priorities must be normalized rather than spread into characters');
assert.ok(malformedCommand.command.priorities.includes('high'));
assert.ok(malformedCommand.command.stopConditions.includes('manual'));
assert.ok(malformedCommand.command.blockers.includes('existing'));

assert.equal(stale.chain[0],'ANIL','ANIL must remain the final orchestrator');
assert.equal(stale.chain.length,18,'the collaboration chain must include all 18 roles');
console.log('ANIL complementary council tests: PASS (18 roles, evidence gates, stale Guard, provider quorum, owner approval, release fail-closed)');
