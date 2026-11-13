/**
 * Validates that all papers served by the Backend API conform
 * strictly to the client-side Zod PaperSchema via validatePaper().
 */

import { validatePaper } from '../src/core/import/validate';

const API_URL = process.argv[2] || process.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

async function main() {
  console.log(`Checking backend papers at ${API_URL}...`);
  const catalogRes = await fetch(`${API_URL}/papers`);
  if (!catalogRes.ok) {
    throw new Error(`Failed to fetch catalog: HTTP ${catalogRes.status}`);
  }

  const { items } = (await catalogRes.json()) as { items: Array<{ id: string; totalQuestions: number }> };
  console.log(`Found ${items.length} papers in catalog.`);

  let passed = 0;
  for (const item of items) {
    const res = await fetch(`${API_URL}/papers/${item.id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch paper ${item.id}: HTTP ${res.status}`);
    }
    const paperJson = await res.json();
    const result = validatePaper(paperJson);
    if (!result.success) {
      console.error(`❌ Validation failed for ${item.id}:`, result.issues);
      process.exit(1);
    }
    console.log(`✓ Paper ${item.id} passed Zod validatePaper() (${item.totalQuestions} questions)`);
    passed++;
  }

  console.log(`\n🎉 All ${passed} papers verified successfully with Zod validatePaper()!`);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
