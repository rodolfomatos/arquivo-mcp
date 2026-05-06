import * as cheerio from 'cheerio';
const html = `<html><head><script>var a = 1;</script></head><body><p>Hello</p></body></html>`;
const $ = cheerio.load(html);
$('script').remove();
console.log('After remove:', $.text());