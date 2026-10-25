import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCrunch } from '../src/crunch.ts';
test('fracture sounds are finite, unclipped and fade to silence', () => {
  for (const rate of [44100,48000]) for(let variant=0;variant<6;variant++) {
    const data=makeCrunch(rate,variant);
    assert.ok(data.length/rate<.07);
    const peak=Math.max(...data.map(Math.abs));assert.ok(peak>.1&&peak<1);
    assert.equal(data[0],0);assert.ok(Math.abs(data.at(-1))<.00001);
    assert.deepEqual(data,makeCrunch(rate,variant));
  }
});
