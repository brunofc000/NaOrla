-- NUCLEAR CLEANUP: Drop ALL tables, functions, triggers, types in public schema
-- This handles ANY extra tables from Lovable or previous setups

-- 1) Drop all tables in public schema
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

-- 2) Drop all functions in public schema
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT proname, oidvectortypes(proargtypes) as args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
  END LOOP;
END $$;

-- 3) Drop all triggers in public schema (on auth.users too)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tgname, relname
    FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname IN ('public', 'auth') AND NOT t.tgisinternal
  ) LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON ' ||
      CASE WHEN r.relname = 'users' THEN 'auth.' ELSE 'public.' END || quote_ident(r.relname) || ' CASCADE';
  END LOOP;
END $$;

-- 4) Drop all custom types in public schema
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
  END LOOP;
END $$;

-- 5) Drop ALL storage policies on objects table
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
  END LOOP;
END $$;
