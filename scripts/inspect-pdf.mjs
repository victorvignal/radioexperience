const fs = require('fs');
const { PDFDocument, PDFName, PDFDict, PDFStream } = require('pdf-lib');

async function main() {
  const buffer = fs.readFileSync('C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\USG\\2023\\Prova-Teorica-TP-v1-2023.pdf');
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  
  // For each page, check XObject and collect JPEGs
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageDict = page.node;
    
    try {
      const resources = pageDict.lookup(PDFName.of('Resources'));
      if (!resources || !(resources instanceof PDFDict)) continue;
      
      const xObject = resources.lookup(PDFName.of('XObject'));
      if (!xObject || !(xObject instanceof PDFDict)) continue;
      
      for (const [name, ref] of xObject.entries()) {
        try {
          const stream = xObject.context.lookup(ref);
          if (!(stream instanceof PDFStream)) continue;
          const subtype = stream.dict.lookup(PDFName.of('Subtype'));
          if (!subtype || subtype.asString()?.toString() !== 'Image') continue;
          const filter = stream.dict.lookup(PDFName.of('Filter'))?.asString()?.toString();
          if (filter !== 'DCTDecode') continue;
          const size = stream.readBytes().length;
          console.log(`Page ${i+1}: img "${name}" size=${size} filter=${filter}`);
        } catch(e) {}
      }
    } catch(e) {}
  }
}

main().catch(console.error);
