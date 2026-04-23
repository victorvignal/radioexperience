/**
 * Extract images from RDDI 2024 by directly parsing the PDF byte structure
 * Images are stored as FlateDecode streams with /Subtype/Image
 * 
 * Approach:
 * 1. Find all image streams by scanning for /Subtype/Image in the PDF
 * 2. Extract the raw stream data (zlib-compressed)
 * 3. Decompress to get raw image bytes
 * 4. Encode as JPEG base64
 * 5. Map to pages via dimensions
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const PDF_PATH = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

function findAllImageStreams(buffer) {
  const str = buffer.toString('binary')
  const results = []
  
  // Find all "/Subtype/Image" occurrences
  let pos = 0
  while ((pos = str.indexOf('/Subtype/Image', pos)) !== -1) {
    // Get context before this (the object dictionary)
    const start = Math.max(0, pos - 500)
    const dictStr = str.slice(start, pos + 20)
    
    // Extract dimensions
    const widthMatch = dictStr.match(/[/ ]Width\s+(\d+)/)
    const heightMatch = dictStr.match(/[/ ]Height\s+(\d+)/)
    const filterMatch = dictStr.match(/[/ ]Filter\s+(\/\w+)/)
    const lengthMatch = dictStr.match(/[/ ]Length\s+(\d+)/)
    
    const width = widthMatch ? parseInt(widthMatch[1]) : 0
    const height = heightMatch ? parseInt(heightMatch[1]) : 0
    const filter = filterMatch ? filterMatch[1] : null
    const length = lengthMatch ? parseInt(lengthMatch[1]) : 0
    
    // Find the stream start after ">>stream" or ">>\nstream"
    const streamDictEnd = pos + 20
    let streamStart = str.indexOf('stream', streamDictEnd)
    if (streamStart !== -1) {
      streamStart += 6
      // Skip leading whitespace
      while (streamStart < str.length && (str.charCodeAt(streamStart) <= 32 || str.charCodeAt(streamStart) === 160)) streamStart++
      
      // Find endstream
      let streamEnd = str.indexOf('endstream', streamStart)
      
      results.push({
        dictOffset: start,
        streamOffset: streamStart,
        streamEndOffset: streamEnd,
        width, height, filter, length,
      })
    }
    
    pos += 14
  }
  
  return results
}

function extractImageData(buffer, streamInfo) {
  const { streamOffset, streamEndOffset, width, height, filter, length } = streamInfo
  if (!streamOffset || !streamEndOffset || streamOffset >= streamEndOffset) return null
  
  const rawBytes = buffer.slice(streamOffset, streamEndOffset)
  
  if (filter === '/DCTDecode') {
    // JPEG directly
    if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
      return { data: rawBytes, format: 'jpeg', width, height }
    }
  } else if (filter === '/FlateDecode' || filter === '/Flate') {
    // zlib-compressed — decompress
    try {
      const decompressed = zlib.inflateSync(rawBytes)
      return { data: decompressed, format: 'raw', width, height }
    } catch (e) {
      try {
        const decompressed = zlib.inflateRawSync(rawBytes)
        return { data: decompressed, format: 'raw', width, height }
      } catch {}
    }
  }
  
  return null
}

// Build a map: "width x height" -> [imageInfos]
function groupByDimensions(images) {
  const map = new Map()
  for (const img of images) {
    const key = `${img.width}x${img.height}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(img)
  }
  return map
}

async function main() {
  console.log('Loading PDF...')
  const buffer = fs.readFileSync(PDF_PATH)
  console.log(`PDF size: ${buffer.length} bytes\n`)
  
  console.log('Finding all image streams...')
  const streams = findAllImageStreams(buffer)
  console.log(`Found ${streams.length} image streams\n`)
  
  // Show first 10
  console.log('First 10 image streams:')
  for (const s of streams.slice(0, 10)) {
    console.log(`  offset=${s.streamOffset} ${s.width}x${s.height} filter=${s.filter} length=${s.length}`)
  }
  
  console.log('\nExtracting image data...')
  const images = []
  let failed = 0
  
  for (let i = 0; i < streams.length; i++) {
    const s = streams[i]
    if (s.width === 0 || s.height === 0) continue
    
    const imgData = extractImageData(buffer, s)
    if (imgData) {
      const base64 = Buffer.from(imgData.data).toString('base64')
      if (base64.length > 5000) { // Only meaningful images
        images.push({
          index: i,
          offset: s.streamOffset,
          width: s.width,
          height: s.height,
          format: imgData.format,
          base64,
          size: base64.length,
        })
      }
    } else {
      failed++
    }
  }
  
  console.log(`\nExtracted ${images.length} images (${failed} failed)`)
  
  // Show size distribution
  images.sort((a, b) => b.size - a.size)
  console.log('\nLargest 20 images:')
  for (const img of images.slice(0, 20)) {
    console.log(`  [${img.index}] offset=${img.offset} ${img.width}x${img.height} ${(img.size/1024).toFixed(0)}KB`)
  }
  
  // Group by dimensions
  const byDim = groupByDimensions(images)
  console.log('\nUnique dimensions:')
  for (const [dim, imgs] of byDim) {
    console.log(`  ${dim}: ${imgs.length} images`)
  }
  
  // Now save images to file for reference
  console.log('\nSaving largest 20 images...')
  for (let i = 0; i < Math.min(20, images.length); i++) {
    const img = images[i]
    fs.writeFileSync(`${OUT}/debug_img_${String(i).padStart(3,'0')}_${img.width}x${img.height}.jpg`, Buffer.from(img.base64, 'base64'))
  }
  console.log('Done!')
}

main().catch(console.error)
