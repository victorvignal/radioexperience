/**
 * RDDI 2024 Image Extraction v3 - FIXED regex
 */
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

let createCanvas
try {
  const canvas = require('canvas')
  createCanvas = canvas.createCanvas
} catch (e) { console.log('canvas not available') }

const PDF_PATH = 'C:\\Users\\vigna\\OneDrive\\Documentos\\Provas CBR\\RDDI\\2024\\Caderno-Completo-com-Gabarito-Preliminar-2024.pdf'
const OUT = 'C:\\Users\\vigna\\.openclaw\\workspace\\radioexperience\\scripts\\cbr_output'

function byteIndexOf(buf, needle, start = 0) {
  for (let i = start; i <= buf.length - needle.length; i++) {
    let found = true
    for (let j = 0; j < needle.length; j++) {
      if (buf[i+j] !== needle[j]) { found = false; break }
    }
    if (found) return i
  }
  return -1
}

function findImageStreams(buffer) {
  const results = []
  const key = Buffer.from('/Subtype/Image')
  let pos = 0

  while ((pos = byteIndexOf(buffer, key, pos)) !== -1) {
    const sliceStart = Math.max(0, pos - 400)
    const dictSlice = buffer.slice(sliceStart, pos + 100)
    const latin1 = dictSlice.toString('latin1')

    const wMatch = latin1.match(/Width[\s\/]+(\d+)/)
    const hMatch = latin1.match(/Height[\s\/]+(\d+)/)
    const fMatch = latin1.match(/\/Filter\/(\w+)/)
    const lMatch = latin1.match(/Length[\s\/]+(\d+)/)

    const width = wMatch ? parseInt(wMatch[1]) : 0
    const height = hMatch ? parseInt(hMatch[1]) : 0
    const filterKey = fMatch ? '/' + fMatch[1] : null
    const length = lMatch ? parseInt(lMatch[1]) : 0

    // Find stream start
    const relStreamPos = byteIndexOf(buffer, Buffer.from('stream'), pos)
    if (relStreamPos === -1) { pos += key.length; continue }

    let streamDataStart = relStreamPos + 6
    while (streamDataStart < buffer.length && (buffer[streamDataStart] === 10 || buffer[streamDataStart] === 13 || buffer[streamDataStart] === 32)) streamDataStart++

    // Find endstream
    const endstreamMarker = Buffer.from('endstream')
    let streamDataEnd = byteIndexOf(buffer, endstreamMarker, streamDataStart + 1)
    if (streamDataEnd === -1) { pos += key.length; continue }

    if (width > 0 && height > 0) {
      results.push({ streamOffset: streamDataStart, streamEnd: streamDataEnd, width, height, filter: filterKey, length })
    }
    pos += key.length
  }
  return results
}

function extractImageData(buffer, stream) {
  const { streamOffset, streamEnd, filter } = stream
  if (!streamOffset || !streamEnd || streamOffset >= streamEnd) return null
  const rawBytes = buffer.slice(streamOffset, streamEnd)

  if (filter === '/DCTDecode') {
    if (rawBytes[0] === 0xFF && rawBytes[1] === 0xD8) return { data: rawBytes, format: 'jpeg' }
  } else if (filter === '/FlateDecode') {
    try {
      const dec = zlib.inflateSync(rawBytes)
      return { data: dec, format: 'raw' }
    } catch {}
    try {
      const dec = zlib.inflateRawSync(rawBytes)
      return { data: dec, format: 'raw' }
    } catch {}
  }
  return null
}

function rawToJpeg(data, width, height) {
  return new Promise((resolve) => {
    if (!createCanvas) { resolve(null); return }
    try {
      const canvas = createCanvas(width, height)
      const ctx = canvas.getContext('2d')
      const imgData = ctx.createImageData(width, height)
      for (let i = 0; i < width * height; i++) {
        const g = data[i] || 0
        imgData.data[i*4] = g; imgData.data[i*4+1] = g; imgData.data[i*4+2] = g; imgData.data[i*4+3] = 255
      }
      ctx.putImageData(imgData, 0, 0)
      resolve(canvas.toBuffer('image/jpeg', { quality: 85 }))
    } catch (e) { resolve(null) }
  })
}

async function main() {
  const buffer = fs.readFileSync(PDF_PATH)
  console.log('PDF: ' + (buffer.length / 1024 / 1024).toFixed(1) + ' MB\n')

  const streams = findImageStreams(buffer)
  console.log('Found ' + streams.length + ' image streams\n')

  console.log('First 5:')
  streams.slice(0, 5).forEach(s => console.log('  ' + s.width + 'x' + s.height + ' filter=' + s.filter + ' len=' + s.length))

  const images = []
  for (const s of streams) {
    if (s.width === 0 || s.height === 0) continue
    const imgData = extractImageData(buffer, s)
    if (!imgData) continue

    let base64
    if (imgData.format === 'jpeg') {
      base64 = Buffer.from(imgData.data).toString('base64')
    } else {
      const jpegBuf = await rawToJpeg(imgData.data, s.width, s.height)
      if (!jpegBuf) continue
      base64 = jpegBuf.toString('base64')
    }

    if (base64 && base64.length > 3000) {
      images.push({ offset: s.streamOffset, width: s.width, height: s.height, filter: s.filter, base64, size: base64.length })
    }
  }

  const dct = images.filter(i => i.filter === '/DCTDecode')
  const flat = images.filter(i => i.filter === '/FlateDecode')
  console.log('\nExtracted: ' + images.length + ' (' + dct.length + ' DCT, ' + flat.length + ' Flate)')
  console.log('Total base64: ' + Math.round(images.reduce((s,i) => s+i.size, 0)/1024) + ' KB')

  images.sort((a, b) => a.offset - b.offset)
  console.log('\nAll images:')
  images.forEach((img, i) => {
    console.log('  [' + i + '] offset=' + img.offset + ' ' + img.width + 'x' + img.height + ' ' + img.filter + ' ' + Math.round(img.size/1024) + 'KB')
  })

  // Save top 20 largest
  const sorted = images.slice().sort((a, b) => b.size - a.size)
  console.log('\nSaving top 20...')
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const img = sorted[i]
    const num = String(i).padStart(3, '0')
    const fn = OUT + '/img_' + num + '_' + img.width + 'x' + img.height + '_' + Math.round(img.size/1024) + 'KB.jpg'
    fs.writeFileSync(fn, Buffer.from(img.base64, 'base64'))
    console.log('  img_' + num + ': ' + img.width + 'x' + img.height + ' ' + Math.round(img.size/1024) + 'KB')
  }
  console.log('\nDone!')
}

main().catch(console.error)
