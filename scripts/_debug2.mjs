import fs from 'fs';

const filePath = 'C:/Users/vigna/.openclaw/workspace/radioexperience/backend/main.py';
const content = fs.readFileSync(filePath, 'utf8');

// Find saved_q options
const search1 = 'saved_q["options"]';
const idx1 = content.indexOf(search1);
console.log('saved_q options at:', idx1);
if (idx1 >= 0) {
    // Get the surrounding text
    const start = idx1 - 50;
    const end = idx1 + 350;
    const snippet = content.substring(start, end);
    console.log('Snippet (escaped):');
    console.log(JSON.stringify(snippet));
}