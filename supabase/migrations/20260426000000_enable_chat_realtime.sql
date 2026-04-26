ALTER TABLE IF EXISTS public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.chat_threads REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;

        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END
$$;

ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_threads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'chat_messages'
          AND policyname = 'chat_messages_realtime_read'
    ) THEN
        EXECUTE '
            CREATE POLICY chat_messages_realtime_read
            ON public.chat_messages
            FOR SELECT
            TO anon, authenticated
            USING (true)
        ';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'chat_threads'
          AND policyname = 'chat_threads_realtime_read'
    ) THEN
        EXECUTE '
            CREATE POLICY chat_threads_realtime_read
            ON public.chat_threads
            FOR SELECT
            TO anon, authenticated
            USING (true)
        ';
    END IF;
END
$$;
