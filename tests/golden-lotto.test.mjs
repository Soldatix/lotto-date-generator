import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const load = source =>
  import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const generator = await load(readFileSync('src/js/generator.js', 'utf8'));
const { presets } = await load(readFileSync('src/data/presets.js', 'utf8'));

const presetById = Object.fromEntries(presets.map(preset => [preset.id, preset]));

function draw(preset, date, personalKey = '') {
  const parsed = generator.parseDMY(date);
  assert.ok(parsed, `Date must be valid: ${date}`);

  const salt = personalKey.trim();
  const seedBase =
    `${parsed.iso}|${preset.m}|${preset.mm}|${preset.e}|${preset.em}|${salt}`;

  return {
    main: generator.uniqueNums(
      preset.m,
      preset.mm,
      generator.mulberry32(generator.hash32(seedBase + '|main'))
    ),
    extra: preset.e
      ? generator.uniqueNums(
          preset.e,
          preset.em,
          generator.mulberry32(generator.hash32(seedBase + '|extra'))
        )
      : []
  };
}

function assertGroup(values, count, max, label) {
  assert.equal(values.length, count, `${label}: wrong count`);

  assert.deepEqual(
    values,
    [...values].sort((a, b) => a - b),
    `${label}: values must remain sorted`
  );

  assert.equal(
    new Set(values).size,
    values.length,
    `${label}: duplicate values are not allowed`
  );

  for (const value of values) {
    assert.ok(
      Number.isInteger(value) && value >= 1 && value <= max,
      `${label}: ${value} is outside 1-${max}`
    );
  }
}

const GOLDEN_17_09_2026 = {
  '6': {
    main: [2, 3, 20, 23, 25, 30],
    extra: []
  },

  '6+1': {
    main: [5, 8, 15, 18, 28, 40],
    extra: [10]
  },

  '7': {
    main: [2, 3, 4, 8, 11, 34, 39],
    extra: []
  },

  '5+2': {
    main: [3, 24, 29, 31, 34],
    extra: [5, 9]
  },

  '5+1': {
    main: [9, 13, 17, 33, 37],
    extra: [11]
  },

  '6+2': {
    main: [3, 11, 15, 17, 31, 49],
    extra: [2, 4]
  }
};

test('fixed golden Lotto outputs for 17/09/2026 remain unchanged', () => {
  for (const [id, expected] of Object.entries(GOLDEN_17_09_2026)) {
    const preset = presetById[id];
    assert.ok(preset, `Missing preset ${id}`);

    const actual = draw(preset, '17/09/2026', '');

    assert.deepEqual(
      actual,
      expected,
      `Golden output changed for preset ${id}`
    );

    assertGroup(actual.main, preset.m, preset.mm, `${id} main`);
    assertGroup(actual.extra, preset.e, preset.em, `${id} extra`);
  }
});

test('fixed Personal Key golden outputs preserve trimming and case sensitivity', () => {
  const preset = presetById['6'];
  assert.ok(preset, 'Missing preset 6');

  const expectedZagreb = {
    main: [10, 11, 15, 32, 36, 48],
    extra: []
  };

  const expectedLowercase = {
    main: [7, 14, 21, 31, 35, 44],
    extra: []
  };

  const zagreb = draw(preset, '17/09/2026', 'Zagreb');
  const padded = draw(preset, '17/09/2026', ' Zagreb ');
  const lowercase = draw(preset, '17/09/2026', 'zagreb');

  assert.deepEqual(
    zagreb,
    expectedZagreb,
    'Golden output changed for "Zagreb"'
  );

  assert.deepEqual(
    padded,
    expectedZagreb,
    'Whitespace trimming changed for " Zagreb "'
  );

  assert.deepEqual(
    lowercase,
    expectedLowercase,
    'Case-sensitive golden output changed for "zagreb"'
  );

  assert.notDeepEqual(
    lowercase,
    zagreb,
    'Personal Key must remain case-sensitive'
  );

  assertGroup(zagreb.main, preset.m, preset.mm, 'Zagreb main');
  assertGroup(lowercase.main, preset.m, preset.mm, 'zagreb main');
});
