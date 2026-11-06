import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';

const zip = new JSZip();
for (const file of ['main.js', 'manifest.json', 'style.css']) {
  zip.file(`ai-doc-sidebar/${file}`, await readFile(`dist/ai-doc-sidebar/${file}`));
}
await writeFile('typora-ai-sidebar.zip', await zip.generateAsync({
  type: 'nodebuffer', compression: 'DEFLATE',
}));
console.log('已生成 typora-ai-sidebar.zip（包含 ai-doc-sidebar/）');
