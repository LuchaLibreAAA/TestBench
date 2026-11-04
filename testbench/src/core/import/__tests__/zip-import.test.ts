import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { importPaperZip } from '../zip-import';

describe('ZIP Paper Importer', () => {
  it('rejects corrupt zip', () => {
    const corruptBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const res = importPaperZip(corruptBytes);
    expect(res.success).toBe(false);
    expect(res.issues[0].message).toContain('invalid ZIP archive');
  });

  it('rejects zip missing paper.json', () => {
    const zipped = zipSync({
      'readme.txt': strToU8('hello world'),
    });
    const res = importPaperZip(zipped);
    expect(res.success).toBe(false);
    expect(res.issues[0].message).toContain('missing "paper.json"');
  });

  it('successfully unzips and validates valid paper.json with assets', () => {
    const paper = {
      schemaVersion: 1,
      id: 'zip-mock-01',
      title: 'Zip Mock Test',
      exam: 'custom',
      durationMin: 60,
      languages: ['en'],
      navigation: 'free',
      sections: [
        {
          id: 's1',
          name: 'Section 1',
          marking: { correct: 4, wrong: -1, unattempted: 0 },
          questions: [
            {
              id: 'q1',
              type: 'single',
              text: 'Look at the diagram',
              images: ['diagram.png'],
              options: [
                { id: 'a', text: 'Option A' },
                { id: 'b', text: 'Option B' },
              ],
              answer: ['a'],
            },
          ],
        },
      ],
    };

    const zipped = zipSync({
      'paper.json': strToU8(JSON.stringify(paper)),
      'images/diagram.png': new Uint8Array([137, 80, 78, 71]), // dummy PNG signature
    });

    const res = importPaperZip(zipped);
    expect(res.success).toBe(true);
    expect(res.paper).toBeDefined();
    expect(res.paper?.id).toBe('zip-mock-01');
    expect(res.assets.length).toBe(1);
    expect(res.assets[0].filename).toBe('diagram.png');
  });
});
