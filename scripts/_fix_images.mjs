import fs from 'fs';

const filePath = 'C:/Users/vigna/.openclaw/workspace/radioexperience/backend/main.py';
let content = fs.readFileSync(filePath, 'utf8');

console.log('File length:', content.length);

// Fix 1: Add image fields to saved_q response
// Pattern: "options": saved_q["options"],\r\n + 24 spaces + "time_per_question"...\r\n + 20 spaces + )\r\n + 12 spaces + else:
const old1 = '"options": saved_q["options"],\r\n                        "time_per_question": req.time_per_question,\r\n                    })\r\n            else:';

const new1 = '"options": saved_q["options"],\r\n                        "image_base64": saved_q.get("image_base64"),\r\n                        "has_image": saved_q.get("has_image", False),\r\n                        "time_per_question": req.time_per_question,\r\n                    })\r\n            else:';

if (content.includes(old1)) {
    content = content.replace(old1, new1);
    console.log('Fix 1 applied');
} else {
    console.log('Fix 1 NOT found');
}

// Fix 2: Add image fields to saved response
const old2 = '"options": saved["options"],\r\n                        "time_per_question": req.time_per_question,\r\n                    })\r\n        except Exception';

const new2 = '"options": saved["options"],\r\n                        "image_base64": saved.get("image_base64"),\r\n                        "has_image": saved.get("has_image", False),\r\n                        "time_per_question": req.time_per_question,\r\n                    })\r\n        except Exception';

if (content.includes(old2)) {
    content = content.replace(old2, new2);
    console.log('Fix 2 applied');
} else {
    console.log('Fix 2 NOT found');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('File saved, length:', content.length);

// Verify
const newContent = fs.readFileSync(filePath, 'utf8');
const hasFix1 = newContent.includes('saved_q.get("image_base64")');
const hasFix2 = newContent.includes('saved.get("image_base64")');
console.log('Verification - Fix 1 present:', hasFix1);
console.log('Verification - Fix 2 present:', hasFix2);
console.log('Done!');