import { unzipSync } from 'fflate';
import { validatePaper, type Issue } from './validate';
import type { Paper, Question } from '../schema';

export interface ZipImportResult {
  success: boolean;
  paper?: Paper;
  assets: Array<{ filename: string; blob: Blob; mimeType: string }>;
  issues: Issue[];
}

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
};

/**
 * Imports and validates a ZIP archive containing paper.json and optional images/.
 */
export function importPaperZip(buffer: Uint8Array): ZipImportResult {
  const issues: Issue[] = [];
  let unzipped: Record<string, Uint8Array>;

  try {
    unzipped = unzipSync(buffer);
  } catch (err) {
    return {
      success: false,
      assets: [],
      issues: [
        {
          level: 'error',
          path: '',
          message: `Corrupt or invalid ZIP archive: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  // Find paper.json (could be at root or inside a single top-level folder)
  let paperJsonPath: string | null = null;
  for (const path of Object.keys(unzipped)) {
    // Zip-slip security protection: ensure no traversal
    if (path.includes('..') || path.startsWith('/') || path.startsWith('\\')) {
      return {
        success: false,
        assets: [],
        issues: [{ level: 'error', path, message: 'Malicious path traversal detected in ZIP' }],
      };
    }

    if (path.toLowerCase().endsWith('paper.json')) {
      paperJsonPath = path;
      break;
    }
  }

  if (!paperJsonPath) {
    return {
      success: false,
      assets: [],
      issues: [{ level: 'error', path: '', message: 'ZIP archive missing "paper.json"' }],
    };
  }

  // Parse paper.json
  const textDecoder = new TextDecoder('utf-8');
  let rawJson: unknown;
  try {
    const jsonStr = textDecoder.decode(unzipped[paperJsonPath]);
    rawJson = JSON.parse(jsonStr);
  } catch (err) {
    return {
      success: false,
      assets: [],
      issues: [
        {
          level: 'error',
          path: paperJsonPath,
          message: `Failed to parse paper.json: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  // Validate paper structure
  const valResult = validatePaper(rawJson);
  if (!valResult.success || !valResult.data) {
    return {
      success: false,
      assets: [],
      issues: valResult.issues,
    };
  }

  const paper = valResult.data;

  // Extract all assets and map filenames
  const assets: Array<{ filename: string; blob: Blob; mimeType: string }> = [];
  const assetMap = new Set<string>();

  for (const [rawPath, bytes] of Object.entries(unzipped)) {
    if (rawPath === paperJsonPath || rawPath.endsWith('/')) continue;

    // Normalize filename (strip prefix like images/ or folder/)
    const parts = rawPath.split(/[\/\\]/);
    const filename = parts[parts.length - 1];
    if (!filename) continue;

    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';

    // Size limit check (max 10MB per image)
    if (bytes.length > 10 * 1024 * 1024) {
      issues.push({
        level: 'warning',
        path: rawPath,
        message: `Asset "${filename}" exceeds recommended 10MB size limit (${Math.round(bytes.length / 1024)} KB)`,
      });
    }

    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    assets.push({ filename, blob, mimeType });
    assetMap.add(filename);
    assetMap.add(rawPath);
  }

  // Cross-reference: Verify all images in the paper actually exist in the archive
  for (const section of paper.sections) {
    for (const q of section.questions as Question[]) {
      if (q.images) {
        for (const img of q.images) {
          const imgName = img.split(/[\/\\]/).pop() ?? img;
          if (!assetMap.has(img) && !assetMap.has(imgName)) {
            issues.push({
              level: 'warning',
              path: `question[${q.id}].images`,
              qid: q.id,
              message: `Referenced image "${img}" not found in ZIP archive`,
            });
          }
        }
      }

      if (q.explanationImages) {
        for (const img of q.explanationImages) {
          const imgName = img.split(/[\/\\]/).pop() ?? img;
          if (!assetMap.has(img) && !assetMap.has(imgName)) {
            issues.push({
              level: 'warning',
              path: `question[${q.id}].explanationImages`,
              qid: q.id,
              message: `Referenced explanation image "${img}" not found in ZIP archive`,
            });
          }
        }
      }

      if ('options' in q && Array.isArray(q.options)) {
        for (const opt of q.options) {
          if (opt.image) {
            const imgName = opt.image.split(/[\/\\]/).pop() ?? opt.image;
            if (!assetMap.has(opt.image) && !assetMap.has(imgName)) {
              issues.push({
                level: 'warning',
                path: `question[${q.id}].options[${opt.id}].image`,
                qid: q.id,
                message: `Referenced option image "${opt.image}" not found in ZIP archive`,
              });
            }
          }
        }
      }
    }
  }

  return {
    success: true,
    paper,
    assets,
    issues: [...valResult.issues, ...issues],
  };
}
