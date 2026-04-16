# Memória do RadioeXperience

> Registra todas as mudanças, decisões e contexto de desenvolvimento.

---

## Histórico de Mudanças

### 2026-04-16
**Fix: Modo Edição no eX StudyLabs**
- Backend (`/chat/edit`): modelo `gpt-4o` → `gpt-5.4-mini` (padronizado com demais endpoints)
- Frontend (`Create.jsx`): "ARIA Edit" → "✏️ Modo Edição — eX StudyLabs" em 2 lugares (header e introdução do painel)
- Commit: `0b9fda8 fix(chat/edit): modelo gpt-4o→gpt-5.4-mini; frontend: 'ARIA Edit'→'Modo Edição — eX StudyLabs'`
- Push: Feito para `main`, deploy automático Railway + Vercel

### 2026-04-15
**Correção de credenciais GitHub**
- Email do commit corrigido para `vignal27@gmail.com`
- git config `--global` setado corretamente

**httrx adicionado ao requirements.txt**
- Commit: `9be5f3c fix: add httpx to backend requirements.txt`

**Challenge questions deduplication + leaderboard + ARIA**
- Commit: `6dbde79 fix: Challenge questions deduplication, leaderboard rank, ARIA page improvements`

**MyProjects: delete + badges Público/Privado/Rascunho**
- Commit: `c558cce feat(MyProjects): delete projects + visibility badges (Público/Privado/Rascunho)`

**Load saved project abre editor + botões copiar/exportar/editar**
- Commit: `ad5d564 fix(Create,MyProjects): load saved project opens editor; add copy/export/edit buttons`

**Article Hunter: resumo rico com IA**
- Commit: `65b47fc feat(article_hunter): generate rich AI summary for curated articles`

### 2026-04-14
**Estabilidade do mapa mental e markmap**
- Commits: `090b8fa`, `a96592b`, `002e9f3` — various fixes para renderização em iPhone e deletions

**eX StudyLabs adicionado ao dashboard**
- Commit: `a9349c4 Add ex studylabs to dashboard tools`
- Commit: `91b71b9 Add markmap mind maps to studylab create`

---

## Repositório
- **Repo**: `https://github.com/victorvignal/radioexperience`
- **Clone local**: `/tmp/radioexperience`
- **Origem Windows**: `/mnt/c/Users/vigna/hermes/radioexperience-main/radioexperience`
- **GitHub PAT**: `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`

---

## Infraestrutura
- **Frontend**: Vercel (`victorvignal.github.io`) — auto-deploy em push para `main`
- **Backend**: Railway (`aria-backend-production`) — auto-deploy em push para `main`
- **Banco**: Supabase (PostgreSQL + Auth)
- **Vetores**: Qdrant (RAG/embeddings)
- **Docker**: `docker-compose.yml` na raiz (backend + qdrant local)

---

## Problemas Known
1. Ao salvar projeto e abrir depois, o fluxo ia para Study Labs em vez do editor — **PARCIALMENTE CORRIGIDO** (commit `ad5d564`)
2. `/chat/edit` usava `gpt-4o` em vez de `gpt-5.4-mini` — **CORRIGIDO**

---

## Pendências
- [ ] Verificar se fluxo "salvar projeto → abrir" vai corretamente para o editor de criação com conteúdo carregado
- [ ] Testar `/chat/edit` com novo modelo `gpt-5.4-mini`
- [ ] Considerar adicionar mais clareza visual no painel de edição (talvez badge "MODO EDIÇÃO")

---

## Documentação (docs/)

A partir de 2026-04-16, toda mudança no RadioeXperience deve atualizar:

1. **`docs/radioexperience_MEMORIA.md`** — histórico de mudanças, pendências, problemas known
2. **`docs/radioexperience_RESUMO.md`** — documentação técnica completa (endpoints, pages, fluxos, banco, etc.)

### 2026-04-16 — Documentação Criada
- Criados `docs/radioexperience_MEMORIA.md` e `docs/radioexperience_RESUMO.md`
- Commit: `888ca41 docs: add MEMORIA and RESUMO for RadioeXperience`
- Push: Feito para `main`

### 2026-04-16 — Fix Dashboard Mobile
- `height:100vh` → `minHeight:100dvh` no layout mobile (corrige scroll travado)
- Removido botão "Meus Projetos" duplicado da top bar mobile
- Restaurados todos os tools no scroll horizontal do mobile
- Commit: `8b2e9a6 fix(Dashboard): mobile scroll with 100dvh, remove duplicate Meus Projetos button, restore tools`
- Push: Feito para `main`
