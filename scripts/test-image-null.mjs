/**
 * Test: ingest a single question with image but no answer
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const SUPABASE_URL = 'https://pcdequsipbkxcfsewiow.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZGVxdXNpcGJreGNmc2V3aW93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYzNjU4MSwiZXhwIjoyMDkwMjEyNTgxfQ.kr5aybwZxJAwlA7CqhMo2nL3e_ZRx_dl9LyOO2peGN4'

function httpPost(table, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = require('https').request(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: JSON.parse(d) }) }
        catch { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: d }) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  // Test with has_image=true but correct_answer=null
  const test = [{
    specialty: 'Geral',
    question_text: 'Test question with image',
    question_type: 'multiple_choice',
    options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D', E: 'Option E' },
    correct_answer: null,
    explanation: 'Test',
    source_title: 'TEST',
    difficulty: 'medium',
    image_base64: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAkAD8DASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABQYH/8QAIhAAAQMDAwUBAAAAAAAAAAAAAQIDBAUGEQASIQcTMUFR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAWEQEBAQAAAAAAAAAAAAAAAAAAEQH/2gAMAwEAAhEDEEA/AKHVu4bjcLhPoYW+22w06pt1bKy4tKSk5BA5x4qLVrJc5N0lTIVxjR0SXluoaVGUopSokAHLgzgUpVqf/Z',
    has_image: true,
    times_used: 0,
  }]
  
  const { ok, status, body } = await httpPost('challenge_question_pool', test)
  console.log('Result:', ok, status)
  if (!ok) console.log('Error:', JSON.stringify(body))
  else console.log('Success!')
}

main().catch(console.error)
