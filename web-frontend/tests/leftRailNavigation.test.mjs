import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(webRoot, 'src', 'components', 'premium', 'LeftRail.tsx'),
  'utf8',
);

test('LeftRail exposes Action Center exactly once and does not fake a separate History route', () => {
  const bottomBlock = source.slice(
    source.indexOf('const BOTTOM_ITEMS'),
    source.indexOf('export default function LeftRail'),
  );

  const actionCenterIds = bottomBlock.match(/id:\s*'action-center'/g) ?? [];
  assert.equal(actionCenterIds.length, 1);
  assert.doesNotMatch(bottomBlock, /labelEn:\s*'History'/);
  assert.doesNotMatch(bottomBlock, /icon:\s*Clock/);
});
