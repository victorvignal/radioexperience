-- ============================================================
-- ARIA Chat Sync - SQL migration for Supabase
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Tabela de sessões de chat ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aria_chat_sessions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Nova conversa',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.aria_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Usuário só vê suas próprias sessões
CREATE POLICY "Users can manage own sessions" ON public.aria_chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ── Tabela de mensagens ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aria_chat_messages (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  uuid        NOT NULL REFERENCES public.aria_chat_sessions(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'bot')),
  text        text        NOT NULL,
  image_b64   text,  -- só guarda se tiver imagem (armazenada como base64 puro, sem data URL)
  sources     jsonb, -- array de sources do RAG
  tokens_used int,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.aria_chat_messages ENABLE ROW LEVEL SECURITY;

-- Mensagens seguem a política da sessão (access via session ownership)
CREATE POLICY "Users can manage own messages" ON public.aria_chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.aria_chat_sessions
      WHERE id = aria_chat_messages.session_id AND user_id = auth.uid()
    )
  );

-- Index pra buscar rápido mensagens por sessão
CREATE INDEX IF NOT EXISTS aria_chat_messages_session_id_idx
  ON public.aria_chat_messages (session_id, created_at ASC);

-- Index pra buscar sessões por usuário
CREATE INDEX IF NOT EXISTS aria_chat_sessions_user_id_idx
  ON public.aria_chat_sessions (user_id, updated_at DESC);

-- ── Função: manter no máximo 5 sessões por usuário ─────────────────────────────
CREATE OR REPLACE FUNCTION enforce_max_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Se novo insert, verifica limite e remove oldest
  IF TG_OP = 'INSERT' THEN
    DELETE FROM public.aria_chat_sessions
    WHERE user_id = NEW.user_id
      AND id NOT IN (
        SELECT id FROM public.aria_chat_sessions
        WHERE user_id = NEW.user_id
        ORDER BY updated_at DESC
        LIMIT 5
      );
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger após insert em aria_chat_sessions
DROP TRIGGER IF EXISTS trg_enforce_max_sessions ON public.aria_chat_sessions;
CREATE TRIGGER trg_enforce_max_sessions
  AFTER INSERT ON public.aria_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_max_sessions();