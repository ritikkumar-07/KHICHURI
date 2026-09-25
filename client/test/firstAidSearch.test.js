import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRST_AID, FIRST_AID_SEARCH_ALIASES } from '../src/services/offlineStorage.js';
import { searchFirstAid } from '../src/services/firstAidSearch.js';

const first = query => searchFirstAid(FIRST_AID, query, FIRST_AID_SEARCH_ALIASES)[0]?.title;
const dehydration = 'Heatstroke & Dehydration';

for (const query of ['dehydration', 'de', 'dehy', 'dehydraton', 'dehidration', 'dyhydration', 'thirsty dizzy', 'no water weakness']) test(`${query} ranks dehydration first`, () => assert.equal(first(query), dehydration));
test('chokin ranks Choking first', () => assert.equal(first('chokin'), 'Choking (Conscious & Unconscious)'));
test('fractur ranks Fractures first', () => assert.equal(first('fractur'), 'Fractures & Sprains'));
test('seizur ranks Seizures first', () => assert.equal(first('seizur'), 'Seizures / Convulsions'));
test('burn hand ranks Burns first', () => assert.equal(first('burn hand'), 'Burns & Scalds'));
test('hot water skin ranks Burns first', () => assert.equal(first('hot water skin'), 'Burns & Scalds'));
test('random nonsense returns no result', () => assert.equal(first('asdfgh123'), undefined));
test('clearing search restores every guide', () => assert.equal(searchFirstAid(FIRST_AID, '', FIRST_AID_SEARCH_ALIASES).length, FIRST_AID.length));

for (const query of ['CH', 'CHO', 'CHA', 'CHAKING', 'CHOCKING', 'CHOKNG', 'CHOKIN', 'CHOKING']) test(`${query} ranks Choking first`, () => assert.equal(first(query), 'Choking (Conscious & Unconscious)'));
