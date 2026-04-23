import fs from 'fs';

const filePath = 'C:/Users/vigna/.openclaw/workspace/radioexperience/backend/main.py';
const content = fs.readFileSync(filePath, 'utf8');

// Find saved_q options - using a simple search string
const search1 = 'saved_q["options"]';
const idx1 = content.indexOf(search1);
console.log('saved_q options at:', idx1);
if (idx1 >= 0) {
    console.log('Context:', JSON.stringify(content.substring(idx1-20, idx1+300)));
}

// Find saved options
const search2 = 'saved["options"]';
const idx2 = content.indexOf(search2);
console.log('\nsaved options at:', idx2);
if (idx2 >= 0) {
    console.log('Context:', JSON.stringify(content.substring(idx2-20, idx2+300)));
}