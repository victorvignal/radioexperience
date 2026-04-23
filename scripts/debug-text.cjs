const fs = require('fs')
const d = JSON.parse(fs.readFileSync('cbr_output/extracted_RDDI_2020.json', 'utf8'))
const q = Array.isArray(d) ? d : Object.values(d)
console.log('Total Q:', q.length)
var qq = q[0]
console.log('Q0 keys:', Object.keys(qq))
console.log('Q0 question_text:', qq.question_text)
console.log('Q0 question_text type:', typeof qq.question_text)
console.log('Q0 question_text === undefined:', qq.question_text === undefined)
console.log('Q0 question_text === null:', qq.question_text === null)
if (qq.question_text && typeof qq.question_text === 'string') {
  console.log('Q0 first 50:', qq.question_text.slice(0, 50))
} else {
  console.log('Q0 question_text is falsy or not a string')
}
