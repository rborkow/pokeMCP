/**
 * Script to fetch and cache Smogon usage statistics
 * Run this periodically to update cached data
 */
import { Statistics } from 'smogon';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const FORMATS = [
  // Gen 9 Singles
  'gen9ou', 'gen9ubers', 'gen9uu', 'gen9ru', 'gen9nu', 'gen9pu', 'gen9lc',
  // Gen 9 VGC
  'gen9vgc2024regg', 'gen9vgc2024regf', 'gen9vgc2024regh',
  // Gen 8 Singles
  'gen8ou', 'gen8ubers', 'gen8uu', 'gen8ru', 'gen8nu', 'gen8pu', 'gen8lc',
  // Gen 7 Singles
  'gen7ou', 'gen7ubers', 'gen7uu', 'gen7ru', 'gen7nu', 'gen7pu', 'gen7lc'
];
const CACHE_DIR = join(process.cwd(), 'src', 'cached-stats');

async function fetchFormatStats(format: string) {
  console.log(`Fetching stats for ${format}...`);

  try {
    const latest = await Statistics.latestDate(format);
    if (!latest) {
      console.warn(`No stats found for ${format}`);
      return null;
    }

    const url = Statistics.url(latest.date, format, true, 'chaos');
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const raw = await response.text();
    const stats = Statistics.process(raw);

    console.log(`✓ Fetched ${format} (${Object.keys(stats.data).length} Pokemon)`);
    return { format, date: latest.date, stats };
  } catch (error) {
    console.error(`✗ Error fetching ${format}:`, error);
    return null;
  }
}

async function main() {
  console.log('Fetching Smogon usage statistics...\n');

  // Create cache directory
  mkdirSync(CACHE_DIR, { recursive: true });

  // Fetch all formats
  const results = await Promise.all(
    FORMATS.map(format => fetchFormatStats(format))
  );

  // Save each format's data
  for (const result of results) {
    if (result) {
      const filename = join(CACHE_DIR, `${result.format}.json`);
      writeFileSync(
        filename,
        JSON.stringify({
          format: result.format,
          fetchedAt: new Date().toISOString(),
          date: result.date,
          data: result.stats
        }, null, 2)
      );
      console.log(`Saved ${result.format} to cache`);
    }
  }

  console.log('\n✓ Cache updated successfully!');
}

main().catch(console.error);
