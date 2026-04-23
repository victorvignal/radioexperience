const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf');

console.log('PDF size:', buf.length, 'bytes');

// Search for image names from operator list in the raw PDF
const names = ['img_p0_1', 'img_p2_1', 'img_p49_1', 'Img0', 'Img1'];
for (const name of names) {
  const idx = buf.indexOf(name);
  if (idx !== -1) {
    console.log(`Found "${name}" at offset ${idx}, context:`, buf.slice(Math.max(0,idx-20), idx+name.length+20).toString('latin1').replace(/[^\x20-\x7E]/g, '.'));
  } else {
    console.log(`"${name}" NOT in PDF`);
  }
}

// Search for stream dictionaries that contain image data
// Look for /Subtype /Image
let count = 0;
for (let i = 0; i < buf.length - 20; i++) {
  if (buf[i] === 0x73 && buf[i+1] === 0x74 && buf[i+2] === 114 && buf[i+3] === 101 && buf[i+4] === 97 && buf[i+5] === 109) {
    // Found "stream"
    let end = i + 6;
    while (end < buf.length && buf[end] === 0x0A || buf[end] === 0x0D || buf[end] === 0x20) end++;
    // Check if before this there's /Subtype /Image
    const before = buf.slice(Math.max(0, i-200), i).toString('latin1');
    if (before.includes('/Image') || before.includes('Subtype') && before.includes('Image')) {
      count++;
      if (count <= 5) {
        console.log(`\nStream at ${i}:`, before.replace(/[^\x20-\x7E]/g, '.').slice(-100));
      }
    }
  }
}
console.log('\nTotal streams with /Image:', count);

// Also check for FlateDecode streams with large size
let largeStreams = 0;
for (let i = 0; i < buf.length - 10; i++) {
  if (buf[i] === 0x73 && buf[i+1] === 0x74 && buf[i+2] === 114 && buf[i+3] === 101 && buf[i+4] === 97 && buf[i+5] === 109) {
    let end = i + 6;
    while (end < buf.length && (buf[end] === 0x0A || buf[end] === 0x0D || buf[end] === 0x20)) end++;
    const start = end;
    // Find endstream
    let e = end;
    while (e < buf.length - 9) {
      if (buf[e] === 0x65 && buf[e+1] === 110 && buf[e+2] === 100 && buf[e+3] === 115 && buf[e+4] === 116 && buf[e+5] === 114 && buf[e+6] === 101 && buf[e+7] === 97 && buf[e+8] === 109) break;
      e++;
    }
    const streamLen = e - start;
    if (streamLen > 50000 && buf[end] === 0x78) { // > 50KB and starts with zlib header
      largeStreams++;
      if (largeStreams <= 3) {
        console.log(`Large zlib stream at ${i}, len=${streamLen}, firstbytes=${buf.slice(end,end+4).toString('hex')}`);
        // Try to decompress
        try {
          const dec = zlib.inflateSync(buf.slice(end, e));
          console.log(`  Decompressed ${dec.length}b, starts with ${dec[0].toString(16)},${dec[1].toString(16)},${dec[2].toString(16)},${dec[3].toString(16)}`);
        } catch(err) {
          // Try raw deflate
          try {
            const dec2 = zlib.inflateRawSync(buf.slice(end, e));
            console.log(`  Raw deflate ${dec2.length}b, starts ${dec2[0].toString(16)},${dec2[1].toString(16)}`);
          } catch {}
        }
      }
    }
  }
}
console.log('Large zlib streams (>50KB):', largeStreams);
