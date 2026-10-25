import test from 'node:test';
import assert from 'node:assert/strict';
import { cutAmount, soapHeight, randomSeed, STROKE_LIMIT, smoothCut } from '../src/mechanics.ts';
test('static or reverse movement never cuts', () => { for (const dy of [0,-1,-1000]) assert.equal(cutAmount(dy,500,0,0),0); });
test('a long stroke is capped and cannot exceed remaining soap', () => { assert.equal(cutAmount(100000,500,0,0),STROKE_LIMIT); assert.equal(cutAmount(100,500,STROKE_LIMIT,0),0); assert.ok(Math.abs(cutAmount(100000,500,0,.99)-.01)<1e-10); });
test('progress is distance based regardless of event rate', () => { let used = 0; for(let i=0;i<20;i++) used += cutAmount(5,500,used,used); assert.ok(Math.abs(used-cutAmount(100,500,0,0))<1e-10); });
test('multiple strokes finish and height decreases without going negative', () => { let p=0; for(let i=0;i<10;i++) p+=cutAmount(100000,500,0,p); assert.equal(p,1); assert.ok(soapHeight(0)>soapHeight(.5)); assert.ok(soapHeight(1)>0); assert.equal(soapHeight(2),soapHeight(1)); });
test('marble seed is repeatable and bounded', () => { const a=randomSeed(42),b=randomSeed(42); for(let i=0;i<100;i++){const n=a();assert.equal(n,b());assert.ok(n>=0&&n<1);} });
test('smoothing preserves total cut and settles at 30, 60 and 120fps', () => {
  for (const fps of [30,60,120]) { let pending=STROKE_LIMIT,total=0; for(let i=0;i<fps;i++){const step=smoothCut(pending,1/fps);assert.ok(step>=0&&step<=pending);pending-=step;total+=step;} assert.equal(pending,0);assert.ok(Math.abs(total-STROKE_LIMIT)<1e-12); }
  assert.equal(smoothCut(0,1/60),0);
  assert.ok(smoothCut(.1,1/60)<.1);
});
