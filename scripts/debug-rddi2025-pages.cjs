const pdfjsLib = require('pdfjs-dist')
const fs = require('fs')

const PDF_PATH = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI 2025.pdf'

async function main() {
  const data = new Uint8Array(fs.readFileSync(PDF_PATH))
  const pdf = await pdfjsLib.getDocument({ data }).promise
  console.log('Pages:', pdf.numPages)
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const ops = page.getOperatorList()
    let imgCount = 0
    let imgNames = []
    for (let j = 0; j < ops.fnArray.length; j++) {
      if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject || ops.fnArray[j] === pdfjsLib.OPS.paintJpegXObject) {
        imgCount++
        imgNames.push(ops.argsArray[j][0])
      }
    }
    if (imgCount > 0) {
      console.log('Page', i, ':', imgCount, 'img(s)', JSON.stringify(imgNames))
    }
  }
}
main().catch(console.error)
