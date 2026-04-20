import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#001a2b', bgDeep: '#002233',
  glass: 'rgba(192,214,234,0.07)', glassHover: 'rgba(192,214,234,0.13)',
  glassBorder: 'rgba(192,214,234,0.15)', border: 'rgba(192,214,234,0.1)',
  text: '#F6F2E8', textSoft: '#C0D6EA', textMuted: '#8ba8c4', textDim: '#5a7d9a',
  accent: '#DDFF55', accentGlow: 'rgba(221,255,85,0.15)', accentSoft: 'rgba(221,255,85,0.08)',
  challenge: '#ff6b6b', challengeGlow: 'rgba(255,107,107,0.15)', challengeSoft: 'rgba(255,107,107,0.08)',
  correct: '#5ef0b0', wrong: '#ff6b6b',
}

const API_BASE = 'https://aria-backend-production-176b.up.railway.app'

const SPECIALTIES = [
  { name: 'Geral', icon: '🩺' },
  { name: 'Mama', icon: '🎀' },
  { name: 'Neurorradiologia', icon: '🧠' },
  { name: 'Abdome', icon: '🫁' },
  { name: 'Tórax', icon: '🫀' },
  { name: 'Pediatria', icon: '👶' },
  { name: 'Musculoesquelético', icon: '🦴' },
  { name: 'Intervenção', icon: '💉' },
  { name: 'Vascular', icon: '🩸' },
  { name: 'Obstetrícia', icon: '🤰' },
  { name: 'Cabeça e Pescoço', icon: '🦷' },
]

// ─── Helper: fetch user stats ─────────────────────────────────────────────
async function fetchUserStats(userId) {
  if (!userId) return null
  try {
    const res = await fetch(`${API_BASE}/challenge/history?user_id=${userId}`)
    if (!res.ok) return null
    const data = await res.json()
    const challenges = data.challenges || []
    if (challenges.length === 0) return { total: 0, best: 0, rank: '—' }
    const best = Math.max(...challenges.map(c => c.user_score || 0))
    return { total: challenges.length, best, rank: '—' }
  } catch { return null }
}

// ─── Helper: fetch leaderboard ────────────────────────────────────────────
async function fetchLeaderboard(period = 'weekly', specialty = null) {
  try {
    let url = `${API_BASE}/challenge/leaderboard?period=${period}&limit=5`
    if (specialty && specialty !== 'Geral') url += `&specialty=${encodeURIComponent(specialty)}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return data.rankings || []
  } catch { return [] }
}

// ═══════════════════════════════════════════════════════════════════════════
// Setup Screen
// ═══════════════════════════════════════════════════════════════════════════
function SetupScreen({ onStart, userId }) {
  const [specialty, setSpecialty] = useState('Geral')
  const [numQuestions, setNumQuestions] = useState(10)
  const [timePerQuestion, setTimePerQuestion] = useState(60)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [lbPeriod, setLbPeriod] = useState('weekly')

  useEffect(() => {
    fetchUserStats(userId).then(setStats)
    fetchLeaderboard('weekly').then(setLeaderboard)
  }, [userId])

  useEffect(() => {
    fetchLeaderboard(lbPeriod).then(setLeaderboard)
  }, [lbPeriod])

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/challenge/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, specialty, num_questions: numQuestions, time_per_question: timePerQuestion }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Erro ao iniciar desafio')
      }
      const data = await res.json()
      onStart(data, specialty, timePerQuestion)
    } catch (err) {
      alert(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '80px 24px 40px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 30px rgba(255,107,107,0.15)}50%{box-shadow:0 0 50px rgba(255,107,107,0.3)} }
        * { box-sizing: border-box; }
        .challenge-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .challenge-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .challenge-specialty-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 700px) {
          .challenge-grid-2 { grid-template-columns: 1fr; gap: 12px; }
          .challenge-grid-3 { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .challenge-specialty-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
        }
        @media (max-width: 400px) {
          .challenge-specialty-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ maxWidth: 900, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36, animation: 'fadeUp 0.5s ease' }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>⚔️</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, marginBottom: 6, letterSpacing: '-0.03em' }}>
            <span style={{ color: C.challenge }}>ARIA</span> Challenge
          </h1>
          <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.6 }}>
            Prove que você é melhor que a IA em conhecimento radiológico
          </p>
        </div>

        {/* Stats bar */}
        {stats && stats.total > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 28, flexWrap: 'wrap',
            animation: 'fadeUp 0.5s ease 0.1s both',
          }}>
            {[
              { label: 'Desafios', value: stats.total, color: C.accent },
              { label: 'Melhor Pontuação', value: stats.best, color: C.challenge },
              { label: 'Ranking', value: stats.rank, color: C.textSoft },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ className: 'challenge-grid-2', style: { marginBottom: 24 } }}>
          {/* Left column: Config */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Rules card */}
            <div style={{
              background: C.glass, backdropFilter: 'blur(20px) saturate(1.4)',
              border: `1px solid ${C.glassBorder}`, borderRadius: 20, padding: 22,
              animation: 'fadeUp 0.5s ease 0.15s both',
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.challenge, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                📋 Como Funciona
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Responda questões de múltipla escolha sobre radiologia',
                  'Acerte para ganhar 100 pontos + bônus por velocidade',
                  'A ARIA também responde — dispute para ver quem sabe mais',
                  'Quanto mais rápido acertar, mais pontos ganha',
                ].map((rule, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                      background: C.challengeSoft, border: '1px solid rgba(255,107,107,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: C.challenge,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Specialty picker */}
            <div style={{
              background: C.glass, backdropFilter: 'blur(20px) saturate(1.4)',
              border: `1px solid ${C.glassBorder}`, borderRadius: 20, padding: 22,
              animation: 'fadeUp 0.5s ease 0.2s both',
            }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Especialidade
              </h3>
              <div style={{ className: 'challenge-grid-3' }}>
                {SPECIALTIES.map(s => (
                  <button key={s.name} onClick={() => setSpecialty(s.name)} style={{
                    padding: '10px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                    background: specialty === s.name ? C.challengeSoft : 'rgba(192,214,234,0.04)',
                    border: `1px solid ${specialty === s.name ? 'rgba(255,107,107,0.35)' : C.glassBorder}`,
                    color: specialty === s.name ? C.challenge : C.textMuted,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Game config */}
            <div style={{
              background: C.glass, backdropFilter: 'blur(20px) saturate(1.4)',
              border: `1px solid ${C.glassBorder}`, borderRadius: 20, padding: 22,
              animation: 'fadeUp 0.5s ease 0.25s both',
            }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Questões
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[5, 10, 15].map(n => (
                    <button key={n} onClick={() => setNumQuestions(n)} style={{
                      flex: 1, padding: '10px', borderRadius: 10, fontSize: 16, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: numQuestions === n ? C.challengeSoft : 'rgba(192,214,234,0.04)',
                      border: `1px solid ${numQuestions === n ? 'rgba(255,107,107,0.35)' : C.glassBorder}`,
                      color: numQuestions === n ? C.challenge : C.textMuted,
                      transition: 'all 0.2s',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Tempo por Questão
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[30, 60, 90].map(t => (
                    <button key={t} onClick={() => setTimePerQuestion(t)} style={{
                      flex: 1, padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: timePerQuestion === t ? C.challengeSoft : 'rgba(192,214,234,0.04)',
                      border: `1px solid ${timePerQuestion === t ? 'rgba(255,107,107,0.35)' : C.glassBorder}`,
                      color: timePerQuestion === t ? C.challenge : C.textMuted,
                      transition: 'all 0.2s',
                    }}>{t}s</button>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <button onClick={handleStart} disabled={loading} style={{
              width: '100%', padding: '16px', borderRadius: 14, fontSize: 17, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              background: loading ? 'rgba(255,107,107,0.4)' : C.challenge,
              color: '#fff', border: 'none',
              boxShadow: loading ? 'none' : `0 0 30px ${C.challengeGlow}, 0 4px 20px rgba(0,0,0,0.3)`,
              transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
              animation: loading ? 'none' : 'pulseGlow 3s ease infinite',
            }}>
              {loading ? '⏳ Preparando...' : '⚔️ Iniciar Desafio'}
            </button>
          </div>

          {/* Right column: Leaderboard */}
          <div style={{
            background: C.glass, backdropFilter: 'blur(20px) saturate(1.4)',
            border: `1px solid ${C.glassBorder}`, borderRadius: 20, padding: 22,
            animation: 'fadeUp 0.5s ease 0.3s both', display: 'flex', flexDirection: 'column',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.challenge, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🏆 Ranking
            </h3>
            {/* Period tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(192,214,234,0.04)', borderRadius: 10, padding: 3 }}>
              {[
                { key: 'weekly', label: 'Semanal' },
                { key: 'monthly', label: 'Mensal' },
                { key: 'all', label: 'Todos' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setLbPeriod(tab.key)} style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: lbPeriod === tab.key ? C.challengeSoft : 'transparent',
                  border: 'none',
                  color: lbPeriod === tab.key ? C.challenge : C.textDim,
                  transition: 'all 0.2s',
                }}>{tab.label}</button>
              ))}
            </div>
            {/* Rankings */}
            {leaderboard.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: 13, fontStyle: 'italic' }}>
                Nenhum resultado ainda. Seja o primeiro!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leaderboard.map((entry, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 12,
                    background: i === 0 ? 'rgba(255,215,0,0.06)' : i === 1 ? 'rgba(192,192,192,0.04)' : i === 2 ? 'rgba(205,127,50,0.04)' : 'transparent',
                    border: `1px solid ${i === 0 ? 'rgba(255,215,0,0.15)' : C.border}`,
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: i === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(192,214,234,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800,
                      color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : C.textDim,
                    }}>{entry.rank || i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.user_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{entry.specialty}</div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.challenge, fontVariantNumeric: 'tabular-nums' }}>{entry.best_score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => window.history.back()} style={{
          display: 'block', margin: '0 auto', padding: '10px 20px', borderRadius: 10,
          background: 'transparent', border: `1px solid ${C.glassBorder}`,
          color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>← Voltar</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Battle Screen
// ═══════════════════════════════════════════════════════════════════════════
function BattleScreen({ challenge, specialty, timePerQuestion, onFinish, userId }) {
  const { questions, challenge_id } = challenge
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [result, setResult] = useState(null)
  const [userScore, setUserScore] = useState(0)
  const [aiScore, setAiScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(timePerQuestion)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [allResults, setAllResults] = useState([])
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const timerRef = useRef(null)

  const question = questions[currentIdx]
  const isLastQuestion = currentIdx >= questions.length - 1

  useEffect(() => {
    setTimeLeft(timePerQuestion)
    setQuestionStartTime(Date.now())
    setSelectedAnswer(null)
    setResult(null)
    setShowExplanation(false)
  }, [currentIdx, timePerQuestion])

  useEffect(() => {
    if (result) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          handleAnswer(null, true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [currentIdx, result])

  const handleAnswer = async (answer, isTimeout = false) => {
    if (submitting || result) return
    setSubmitting(true)
    clearInterval(timerRef.current)

    const timeTaken = isTimeout ? timePerQuestion : Math.round((Date.now() - questionStartTime) / 1000)
    setSelectedAnswer(answer)

    try {
      const res = await fetch(`${API_BASE}/challenge/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id,
          question_id: question.id,
          user_answer: answer || '',
          time_taken_seconds: timeTaken,
          user_id: userId,
        }),
      })
      const data = await res.json()
      setResult(data)
      setUserScore(data.user_score)
      setAiScore(data.ai_score)
      setAllResults(prev => [...prev, { ...data, question_number: currentIdx + 1, time_taken: timeTaken }])
      if (data.is_correct) {
        const newStreak = streak + 1
        setStreak(newStreak)
        setMaxStreak(prev => Math.max(prev, newStreak))
      } else {
        setStreak(0)
      }
      setShowExplanation(true)
    } catch (err) {
      console.error('Answer error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const nextQuestion = () => {
    if (isLastQuestion) {
      handleFinish()
    } else {
      setCurrentIdx(prev => prev + 1)
    }
  }

  const handleFinish = async () => {
    try {
      const res = await fetch(`${API_BASE}/challenge/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id }),
      })
      const data = await res.json()
      data._maxStreak = maxStreak
      onFinish(data)
    } catch (err) {
      onFinish({ user_score: userScore, ai_score: aiScore, questions_detail: allResults, _maxStreak: maxStreak })
    }
  }

  const progress = ((currentIdx + 1) / questions.length) * 100
  const timerColor = timeLeft <= 10 ? C.wrong : timeLeft <= 20 ? '#ffb347' : C.accent
  const options = question?.options || {}

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      display: 'flex', flexDirection: 'column', padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes pulseTimer { 0%,100%{opacity:1}50%{opacity:0.6} }
        @keyframes slideIn { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)} }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div style={{
        maxWidth: 800, width: '100%', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 0 12px', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 12,
            background: C.accentSoft, border: `1px solid rgba(221,255,85,0.2)`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim }}>VOCÊ</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{userScore}</span>
          </div>
          <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>vs</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 12,
            background: C.challengeSoft, border: `1px solid rgba(255,107,107,0.2)`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textDim }}>ARIA</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.challenge, fontVariantNumeric: 'tabular-nums' }}>{aiScore}</span>
          </div>
          {streak >= 2 && (
            <div style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)',
              color: '#ffd700', animation: 'popIn 0.3s ease',
            }}>🔥 {streak} seguidas</div>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 12,
          background: `${timerColor}15`, border: `1px solid ${timerColor}30`,
          animation: timeLeft <= 10 ? 'pulseTimer 1s infinite' : 'none',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={timerColor} strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 800, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ maxWidth: 800, width: '100%', margin: '0 auto 20px' }}>
        <div style={{
          height: 6, borderRadius: 3, background: 'rgba(192,214,234,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${C.challenge}, #ff8f8f)`,
            width: `${progress}%`, transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>
            Questão {currentIdx + 1} de {questions.length}
          </span>
          <span style={{ fontSize: 11, color: C.textDim }}>{specialty}</span>
        </div>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
          {questions.map((_, i) => {
            const isCurrent = i === currentIdx
            const isPast = i < currentIdx
            const wasCorrect = isPast && allResults[i]?.is_correct
            return (
              <div key={i} style={{
                width: isCurrent ? 20 : 8, height: 8, borderRadius: 4,
                background: isCurrent ? C.challenge : isPast ? (wasCorrect ? C.correct : C.wrong) : 'rgba(192,214,234,0.1)',
                transition: 'all 0.3s',
              }} />
            )
          })}
        </div>
      </div>

      {/* Question card */}
      <div style={{
        maxWidth: 800, width: '100%', margin: '0 auto', flex: 1,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: C.glass, backdropFilter: 'blur(20px) saturate(1.4)',
          border: `1px solid ${C.glassBorder}`, borderRadius: 20, padding: 28,
          animation: 'slideIn 0.4s ease',
        }}>
          {question?.image_url && (
            <img
              src={question.image_url}
              alt="Questão"
              style={{
                width: '100%',
                maxHeight: 300,
                objectFit: 'contain',
                borderRadius: 12,
                marginBottom: 20,
                border: `1px solid ${C.glassBorder}`,
              }}
            />
          )}
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.65, color: C.text, marginBottom: 24 }}>
            {question?.question_text}
          </p>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(options).map(([key, value]) => {
              const isSelected = selectedAnswer === key
              const isCorrect = result && result.correct_answer === key
              const isWrong = result && isSelected && !result.is_correct
              let optBg = 'rgba(192,214,234,0.05)'
              let optBorder = C.glassBorder
              let optColor = C.textSoft

              if (isCorrect) {
                optBg = 'rgba(94,240,176,0.1)'
                optBorder = 'rgba(94,240,176,0.4)'
                optColor = C.correct
              } else if (isWrong) {
                optBg = 'rgba(255,107,107,0.1)'
                optBorder = 'rgba(255,107,107,0.4)'
                optColor = C.wrong
              } else if (isSelected && !result) {
                optBg = C.challengeSoft
                optBorder = 'rgba(255,107,107,0.4)'
                optColor = C.challenge
              } else if (result) {
                optBg = 'rgba(192,214,234,0.03)'
                optColor = C.textDim
              }

              return (
                <button
                  key={key}
                  onClick={() => !result && handleAnswer(key)}
                  disabled={!!result}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', borderRadius: 14,
                    background: optBg, border: `1px solid ${optBorder}`,
                    color: optColor, fontSize: 14, fontWeight: 600,
                    cursor: result ? 'default' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: isCorrect ? 'rgba(94,240,176,0.2)' : isWrong ? 'rgba(255,107,107,0.2)' : 'rgba(192,214,234,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                  }}>{key}</span>
                  <span>{value}</span>
                  {isCorrect && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
                  {isWrong && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✗</span>}
                </button>
              )
            })}
          </div>

          {/* Explanation */}
          {showExplanation && result && (
            <div style={{
              marginTop: 20, padding: '16px 18px', borderRadius: 14,
              background: result.is_correct ? 'rgba(94,240,176,0.06)' : 'rgba(255,107,107,0.06)',
              border: `1px solid ${result.is_correct ? 'rgba(94,240,176,0.2)' : 'rgba(255,107,107,0.2)'}`,
              animation: 'slideIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18 }}>{result.is_correct ? '🎉' : '📚'}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: result.is_correct ? C.correct : C.wrong }}>
                  {result.is_correct ? `Correto! +${result.points_earned} pontos` : 'Incorreto'}
                </span>
                {result.is_correct && result.points_earned > 100 && (
                  <span style={{ fontSize: 11, color: '#ffb347', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,179,71,0.1)' }}>
                    ⚡ +{result.points_earned - 100} bônus velocidade
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, margin: 0 }}>
                {result.explanation}
              </p>
              <div style={{ marginTop: 8, fontSize: 11, color: C.textDim }}>
                Resposta da ARIA: <strong style={{ color: C.challenge }}>{result.ai_answer}</strong>
              </div>
            </div>
          )}

          {/* Next button */}
          {result && (
            <button onClick={nextQuestion} style={{
              marginTop: 20, width: '100%', padding: '14px', borderRadius: 12,
              background: C.challenge, color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: `0 0 20px ${C.challengeGlow}`,
              animation: 'slideIn 0.3s ease',
            }}>
              {isLastQuestion ? '🏆 Ver Resultados' : 'Próxima Questão →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Result Screen
// ═══════════════════════════════════════════════════════════════════════════
function ResultScreen({ result, onRestart }) {
  const { user_score = 0, ai_score = 0, questions_detail = [], total_time = 0, _maxStreak = 0 } = result
  const won = user_score > ai_score
  const tied = user_score === ai_score
  const correctCount = questions_detail.filter(q => q.is_correct).length
  const total = questions_detail.length || 1
  const accuracy = Math.round((correctCount / total) * 100)

  // Star rating (1-5)
  const starRating = accuracy >= 90 ? 5 : accuracy >= 75 ? 4 : accuracy >= 60 ? 3 : accuracy >= 40 ? 2 : 1

  // Format time
  const mins = Math.floor(total_time / 60)
  const secs = total_time % 60
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  // Leaderboard position — find first entry BETTER than user, position = index+1
  // If no one is better, user is #1
  const [lbPosition, setLbPosition] = useState(null)
  useEffect(() => {
    fetchLeaderboard('weekly').then(ranks => {
      if (!ranks || ranks.length === 0) { setLbPosition(null); return }
      const betterIdx = ranks.findIndex(r => r.best_score > user_score)
      // no one is better → rank 1; otherwise rank = index+1
      setLbPosition(betterIdx === -1 ? 1 : betterIdx + 1)
    })
  }, [user_score])

  const shareText = won
    ? `🏆 Venci a ARIA no Challenge de Radiologia! ${user_score} x ${ai_score} pontos (${correctCount}/${total} questões). Você consegue me superar? #RadioeXperience #ARIAChallenge`
    : tied
    ? `🤝 Empatei com a ARIA! ${user_score} x ${ai_score} pontos (${correctCount}/${total} questões). #RadioeXperience #ARIAChallenge`
    : `🔬 Disputei com a ARIA: ${user_score} x ${ai_score} pontos (${correctCount}/${total} questões). Bora de revanche! #RadioeXperience #ARIAChallenge`

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ text: shareText })
    } else {
      navigator.clipboard.writeText(shareText)
      alert('Resultado copiado!')
    }
  }

  const [expandedQ, setExpandedQ] = useState(null)

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '80px 24px 40px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)} }
        @keyframes starPop { 0%{transform:scale(0)}50%{transform:scale(1.3)}100%{transform:scale(1)} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 700, width: '100%' }}>
        {/* Result header */}
        <div style={{ textAlign: 'center', marginBottom: 28, animation: 'scaleIn 0.5s ease' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>
            {won ? '🏆' : tied ? '🤝' : '💪'}
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, marginBottom: 8, letterSpacing: '-0.03em' }}>
            {won ? 'Você Venceu!' : tied ? 'Empate!' : 'ARIA Venceu!'}
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted }}>
            {won ? 'Parabéns! Você superou a ARIA em conhecimento radiológico.' : tied ? 'Resultado impressionante! Você empatou com a ARIA.' : 'Continue estudando! A ARIA está sempre aprendendo.'}
          </p>
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24, animation: 'slideUp 0.5s ease 0.05s both' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} style={{
              fontSize: 32,
              animation: `starPop 0.4s ease ${i * 0.1}s both`,
              filter: i <= starRating ? 'none' : 'grayscale(1) opacity(0.25)',
            }}>⭐</span>
          ))}
        </div>

        {/* Score comparison with bar chart */}
        <div style={{
          background: C.glass, backdropFilter: 'blur(16px)',
          border: `1px solid ${C.glassBorder}`, borderRadius: 20,
          padding: 24, marginBottom: 20,
          animation: 'slideUp 0.5s ease 0.1s both',
        }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Você</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{user_score}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{correctCount}/{total} corretas · {accuracy}%</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textDim }}>VS</div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>ARIA</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: C.challenge, fontVariantNumeric: 'tabular-nums' }}>{ai_score}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{total}/{total} acertos · always correct</div>
            </div>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.textDim, width: 40, textAlign: 'right' }}>Você</span>
              <div style={{ flex: 1, height: 14, borderRadius: 7, background: 'rgba(192,214,234,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 7,
                  background: `linear-gradient(90deg, ${C.accent}, #b8ff33)`,
                  width: `${Math.min((user_score / Math.max(user_score, ai_score, 1)) * 100, 100)}%`,
                  transition: 'width 1s ease 0.5s',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: C.textDim, width: 40, textAlign: 'right' }}>ARIA</span>
              <div style={{ flex: 1, height: 14, borderRadius: 7, background: 'rgba(192,214,234,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 7,
                  background: `linear-gradient(90deg, ${C.challenge}, #ff8f8f)`,
                  width: `${Math.min((ai_score / Math.max(user_score, ai_score, 1)) * 100, 100)}%`,
                  transition: 'width 1s ease 0.7s',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          className: 'challenge-specialty-grid', style: { marginBottom: 20 },
          animation: 'slideUp 0.5s ease 0.15s both',
        }}>
          {[
            { label: 'Tempo Total', value: timeStr, icon: '⏱️' },
            { label: 'Questões Certas', value: `${correctCount}/${total}`, icon: '✅' },
            { label: 'Melhor Sequência', value: `${_maxStreak || 0} seguidas`, icon: '🔥' },
          ].map((s, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '14px 12px', borderRadius: 14,
              background: C.glass, border: `1px solid ${C.glassBorder}`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Per-question breakdown */}
        <div style={{
          background: C.glass, backdropFilter: 'blur(16px)',
          border: `1px solid ${C.glassBorder}`, borderRadius: 20,
          padding: 20, marginBottom: 20,
          animation: 'slideUp 0.5s ease 0.2s both',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Detalhes por Questão
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {questions_detail.map((q, i) => {
              const isExpanded = expandedQ === i
              return (
                <div key={i}>
                  <button onClick={() => setExpandedQ(isExpanded ? null : i)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 12,
                    background: q.is_correct ? 'rgba(94,240,176,0.04)' : 'rgba(255,107,107,0.04)',
                    border: `1px solid ${q.is_correct ? 'rgba(94,240,176,0.12)' : 'rgba(255,107,107,0.12)'}`,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: q.is_correct ? 'rgba(94,240,176,0.15)' : 'rgba(255,107,107,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: q.is_correct ? C.correct : C.wrong, flexShrink: 0,
                    }}>{q.question_number}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.textSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.question_text}
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                        Sua: {q.user_answer || '—'} · Correta: {q.correct_answer}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: q.is_correct ? C.correct : C.wrong, flexShrink: 0 }}>+{q.points_earned}</span>
                    <span style={{ fontSize: 10, color: C.textDim }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {isExpanded && q.explanation && (
                    <div style={{
                      margin: '4px 0 4px 42px', padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(192,214,234,0.03)', border: `1px solid ${C.border}`,
                      fontSize: 12, color: C.textMuted, lineHeight: 1.6,
                    }}>
                      {q.explanation}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Leaderboard position */}
        {lbPosition && (
          <div style={{
            textAlign: 'center', padding: '14px 20px', borderRadius: 14,
            background: C.glass, border: `1px solid ${C.glassBorder}`,
            marginBottom: 20,
            animation: 'slideUp 0.5s ease 0.25s both',
          }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>Seu ranking semanal: </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.challenge }}>#{lbPosition}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          animation: 'slideUp 0.5s ease 0.3s both',
        }}>
          <button onClick={onRestart} style={{
            padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            background: C.challenge, color: '#fff', border: 'none',
            boxShadow: `0 0 20px ${C.challengeGlow}`,
          }}>⚔️ Jogar Novamente</button>
          <button onClick={handleShare} style={{
            padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            background: C.glass, color: C.textSoft, border: `1px solid ${C.glassBorder}`,
          }}>📤 Compartilhar</button>
          <button onClick={() => window.location.href = '/dashboard'} style={{
            padding: '14px 28px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            background: 'transparent', color: C.textMuted, border: `1px solid ${C.glassBorder}`,
          }}>← Dashboard</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════
export default function ChallengePage() {
  const { user } = useAuth()
  const [phase, setPhase] = useState('setup') // setup | battle | result
  const [challenge, setChallenge] = useState(null)
  const [specialty, setSpecialty] = useState('Geral')
  const [timePerQuestion, setTimePerQuestion] = useState(60)
  const [result, setResult] = useState(null)

  const handleStart = (data, spec, time) => {
    setChallenge(data)
    setSpecialty(spec)
    setTimePerQuestion(time)
    setPhase('battle')
  }

  const handleFinish = (data) => {
    setResult(data)
    setPhase('result')
  }

  const handleRestart = () => {
    setChallenge(null)
    setResult(null)
    setPhase('setup')
  }

  if (phase === 'setup') return <SetupScreen onStart={handleStart} userId={user?.id} />
  if (phase === 'battle') return (
    <BattleScreen
      challenge={challenge}
      specialty={specialty}
      timePerQuestion={timePerQuestion}
      onFinish={handleFinish}
      userId={user?.id}
    />
  )
  if (phase === 'result') return <ResultScreen result={result} onRestart={handleRestart} />
  return null
}
