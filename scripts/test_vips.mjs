// Test sharp PDF rendering with density
import sharp from 'sharp'
import fs from 'fs'

async function main() {
  const pdfPath = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
  
  // Sharp uses libvips which can load PDFs
  // Use density to control resolution
  try {
    // Load PDF with custom density (resolution)
    const pdfBuffer = fs.readFileSync(pdfPath)
    console.log('PDF buffer len:', pdfBuffer.length)
    
    // Try sharp with input density for PDF rendering
    const result = await sharp(pdfBuffer, { density: 150 })
      .jpeg({ quality: 85 })
      .toBuffer()
    console.log('Result len:', result.length)
    
    fs.writeFileSync('sharp_output.jpg', result)
    console.log('Saved sharp_output.jpg')
  } catch (e) {
    console.error('Error:', e.message)
  }
  
  // Also test: can sharp load this as a PDF at all?
  try {
    const meta = await sharp(fs.readFileSync(pdfPath)).metadata()
    console.log('Sharp metadata:', meta)
  } catch (e) {
    console.error('Sharp metadata error:', e.message)
  }
}

main().catch(console.error)