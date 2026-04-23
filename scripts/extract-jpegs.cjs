const fs = require('fs');

function extractJpegs(pdfPath, outPrefix) {
  const buffer = fs.readFileSync(pdfPath);
  const jpegs = [];
  let searchFrom = 0;
  while (true) {
    const start = buffer.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), searchFrom);
    if (start < 0) break;
    const end = buffer.indexOf(Buffer.from([0xFF, 0xD9]), start + 3);
    if (end < 0) break;
    const jpegData = buffer.slice(start, end + 2);
    if (jpegData.length > 5000) {
      const outPath = `C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output\\${outPrefix}_${jpegs.length + 1}.jpg`;
      fs.writeFileSync(outPath, jpegData);
      jpegs.push({ path: outPath, size: jpegData.length });
    }
    searchFrom = end + 2;
  }
  return jpegs;
}

const v1 = extractJpegs('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\USG\\2023\\Prova-Teorica-TP-v1-2023.pdf', 'usg_v1');
const v2 = extractJpegs('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\USG\\2023\\Prova-Teorica-TP-v2-2023.pdf', 'usg_v2');

console.log('V1 JPEGs:', v1.length);
v1.forEach((j, i) => console.log('  ' + (i+1) + '. ' + j.path + ' (' + j.size + ' bytes)'));
console.log('V2 JPEGs:', v2.length);
v2.forEach((j, i) => console.log('  ' + (i+1) + '. ' + j.path + ' (' + j.size + ' bytes)'));
