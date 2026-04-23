// Fix the option trailing number regex
const t = "E) A ressonância magnética com washout seria o método indicado para este tipo de avaliação.6"

// Try simpler: remove trailing number after last option letter pattern
const cleaned = t.replace(/\s*\.\d+$/, '')
console.log('Simple fix:', cleaned)

const t2 = "C) Laceração renal.4"
console.log('Test2:', t2.replace(/\s*\.\d+$/, ''))