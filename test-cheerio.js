import { readFile } from 'fs/promises';
import * as cheerio from 'cheerio';

const html = await readFile('noframe-publico.html', 'utf8');
const $ = cheerio.load(html);
const text = $.text().trim();
console.log('Text length with cheerio:', text.length);
console.log('First 1000 chars:\n', text.substring(0, 1000));

// Save to file for analysis
import { writeFile } from 'fs/promises';
await writeFile('cheerio-extracted.txt', text);
console.log('Saved to cheerio-extracted.txt');
