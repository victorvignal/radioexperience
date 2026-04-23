/**
 * RDDI 2024 Image Extraction v2
 * - DCTDecode images: extract raw JPEG bytes directly
 * - FlateDecode images: decompress, convert DeviceGray raw to JPEG via canvas
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

let createCanvas
try {
  const canvas = require('canvas')
  createCanvas = canvas.createCanvas
} catch (e) {
  console.log('canvas not available:', e.message)
}

const PDF_PATH = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

function findImageStreams(buffer) {
  const str = buffer.toString('binary')
  const results = []
  let pos = 0

  while ((pos = str.indexOf('/Subtype/Image', pos)) !== -1) {
    const start = Math.max(0, pos - 400)
    const slice = buffer.slice(start, pos + 100)
    const latin1 = slice.toString('latin1')

    const wMatch = latin1.match(/\/Width\s+(\d+)/)
    const hMatch = latin1.match(/\/Height\s+(\d+)/)
    const fMatch = latin1.match(/\/Filter\s+(\/\w+)/)
    const lMatch = latin1.match(/\/Length\s+(\d+)/)
    const csMatch = latin1.match(/\/ColorSpace\s+(\/\w+)/)

    const width = wMatch ? parseInt(wMatch[1]) : 0
    const height = hMatch ? parseInt(hMatch[1]) : 0
    const filter = fMatch ? fMatch[1] : null
    const length = lMatch ? parseInt(lMatch[1]) : 0
    const colorSpace = csMatch ? csMatch[1] : '/DeviceGray'

    const relStreamStart = latin1.indexOf('>>stream')
    if (relStreamStart === -1) { pos += 14; continue }
    const streamDictEnd = start + relStreamStart + 9

    let ss = streamDictEnd
    while (ss < buffer.length && (buffer[ss] <= 32 || buffer[ss] === 160)) ss++

    let se = ss + 1
    while (se < buffer.length - 9) {
      if (buffer[se] === 0x65 && buffer[se+1] === 0x6E && buffer[se+2] === 0x64 &&
          buffer[se+3] === 0x73 && buffer[se+4] === 0x74 && buffer[se+5] === 0x72 &&
          buffer[se+6] === 0x65 && buffer[se+7] === 0x61 && buffer[se+8] === 0x6D) break
      se++
    }

    if (width > 0 && height > 0) {
      results.push({ dictOffset: start, streamOffset: ss, streamEnd: se, width, height, filter, length, colorSpace })
    }
    pos += 14
  }
  return results
}

function extractImageData(buffer, stream) {
  const { streamOffset, streamEnd, width, height, filter, colorSpace } = stream
  if (!streamOffset || !streamEnd || streamOffset >= streamEnd) return null

  const rawBytes = buffer.slice(streamOffset, streamEnd)

  if (filter === '/DCTDecode') {
    if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) {
      return { data: rawBytes, format: 'jpeg', width, height, colorSpace }
    }
  } else if (filter === '/FlateDecode') {
    try {
      const decompressed = zlib.inflateSync(rawBytes)
      return { data: decompressed, format: 'raw', width, height, colorSpace }
    } catch {}
    try {
      const decompressed = zlib.inflateRawSync(rawBytes)
      return { data: decompressed, format: 'raw', width, height, colorSpace }
    } catch {}
  }
  return null
}

function rawToJpeg(data, width, height, colorSpace) {
  return new Promise((resolve) => {
    if (!createCanvas) { resolve(null); return }
    try {
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')
      const imgData = ctx.createImageData(width, height)

      if (colorSpace === '/DeviceGray') {
        for (let i = 0; i < width * height; i++) {
          const g = data[i] || 0
          imgData.data[i*4] = g; imgData.data[i*4+1] = g; imgData.data[i*4+2] = g; imgData.data[i*4+3] = 255
        }
      } else {
        for (let i = 0; i < width * height; i++) {
          imgData.data[i*4] = data[i*3]||0; imgData.data[i*4+1] = data[i*3+1]||0; imgData.data[i*4+2] = data[i*3+2]||0; imgData.data[i*4+3] = 255
        }
      }
      ctx.putImageData(imgData, 0, 0)
      const buf = canvas.toBuffer('image/jpeg', { quality: 85 })
      resolve(buf)
    } catch (e) { resolve(null) }
  })
}

async function main() {
  console.log('Loading PDF...')
  const buffer = fs.readFileSync(PDF_PATH)
  console.log('PDF: ' + (buffer.length/1024/1024).toFixed(1) + 'MB\n')

  console.log('Finding image streams...')
  const streams = findImageStreams(buffer)
  console.log('Found ' + streams.length + ' image streams\n')

  console.log('Extracting image data...')
  const images = []

  for (const stream of streams) {
    if (stream.width === 0 || stream.height === 0) continue
    const imgData = extractImageData(buffer, stream)
    if (!imgData) continue

    let base64
    if (imgData.format === 'jpeg') {
      base64 = Buffer.from(imgData.data).toString('base64')
    } else {
      if (!createCanvas) continue
      const jpegBuf = await rawToJpeg(imgData.data, imgData.width, imgData.height, imgData.colorSpace)
      if (jpegBuf) base64 = jpegBuf.toString('base64')
      else continue
    }

    if (base64 && base64.length > 3000) {
      images.push({ offset: stream.streamOffset, width: stream.width, height: stream.height, filter: stream.filter, base64: base64, size: base64.length })
    }
  }

  console.log('Extracted ' + images.length + ' usable images\n')

  const dct = images.filter(i => i.filter === '/DCTDecode')
  const flat = images.filter(i => i.filter === '/FlateDecode')
  console.log('DCTDecode (direct JPEG): ' + dct.length)
  console.log('FlateDecode (converted): ' + flat.length)

  images.sort((a, b) => a.offset - b.offset)

  console.log('\nAll images by offset:')
  images.forEach((img, i) => {
    console.log('  [' + i + '] offset=' + img.offset + ' ' + img.width + 'x' + img.height + ' ' + img.filter + ' ' + Math.round(img.size/1024) + 'KB')
  })

  // Save largest 15 as files
  const sorted = images.slice().sort((a, b) => b.size - a.size)
  console.log('\nSaving largest 15...')
  for (let i = 0; i < Math.min(15, sorted.length); i++) {
    const img = sorted[i]
    const num = String(i).padStart(3, '0')
    const filename = OUT + '/img_' + num + '_' + img.width + 'x' + img.height + '_' + Math.round(img.size/1024) + 'KB.jpg'
    fs.writeFileSync(filename, Buffer.from(img.base64, 'base64'))
    console.log('  Saved: img_' + num + ' ' + img.width + 'x' + img.height + ' ' + Math.round(img.size/1024) + 'KB')
  }
}

main().catch(console.error)
