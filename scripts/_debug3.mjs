import fs from 'fs';

const filePath = 'C:/Users/vigna/.openclaw/workspace/radioexperience/backend/main.py';
const content = fs.readFileSync(filePath, 'utf8');

// Find the target area
const idx = content.indexOf('"options": saved_q["options"]');
if (idx >= 0) {
    // Show exact characters
    const start = idx - 10;
    const end = idx + 200;
    const snippet = content.substring(start, end);
    
    // Print each char with its code
    for (let i = 0; i < snippet.length; i++) {
        const c = snippet[i];
        if (c === '\r') {
            process.stdout.write('[CR]');
        } else if (c === '\n') {
            process.stdout.write('[LF]\n');
        } else if (c === ' ') {
            process.stdout.write(' ');
        } else {
            process.stdout.write(c);
        }
    }
    console.log('\n---');
    console.log('Snippet length:', snippet.length);
    console.log('Bytes:', Buffer.from(snippet).toString('hex'));
}