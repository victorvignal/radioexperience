// Test pdf2pic - fixed API
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { fromPath } = require('pdf2pic')

async function main() {
  const pdfPath = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  
  try {
    const convert = fromPath(pdfPath, {
      density: 150,
      saveFilename: 'page',
      savePath: '.',
      format: 'jpg',
      width: 896,
      height: 1268,
      quality: 85
    })
    
    console.log('Created converter, about to convert page 3...')
    const result = await convert(3)
    console.log('Result:', JSON.stringify(result))
  } catch (e) {
    console.error('Error:', e.message)
  }
}

main().catch(console.error)