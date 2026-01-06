CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'support_staff',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Criar profile com email
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  
  -- Dar role 'user' por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_chamados_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chamados_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: chamados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chamados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_cliente integer NOT NULL,
    qtd_chamados integer NOT NULL,
    protocolo text NOT NULL,
    data_abertura text NOT NULL,
    ultima_atualizacao text NOT NULL,
    responsavel text NOT NULL,
    setor text NOT NULL,
    categoria text NOT NULL,
    motivo_contato text NOT NULL,
    origem text NOT NULL,
    solicitante text NOT NULL,
    urgencia text NOT NULL,
    status text NOT NULL,
    dias_desde_ultimo integer,
    tempo_atendimento text NOT NULL,
    classificacao text NOT NULL,
    insight text NOT NULL,
    chamados_anteriores text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chamados chamados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chamados
    ADD CONSTRAINT chamados_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_chamados_data_abertura; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chamados_data_abertura ON public.chamados USING btree (data_abertura);


--
-- Name: idx_chamados_id_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chamados_id_cliente ON public.chamados USING btree (id_cliente);


--
-- Name: idx_chamados_protocolo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chamados_protocolo ON public.chamados USING btree (protocolo);


--
-- Name: chamados update_chamados_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chamados_updated_at BEFORE UPDATE ON public.chamados FOR EACH ROW EXECUTE FUNCTION public.update_chamados_updated_at();


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chamados Admins can delete chamados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete chamados" ON public.chamados FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles user_roles_1
  WHERE ((user_roles_1.user_id = auth.uid()) AND (user_roles_1.role = 'admin'::public.app_role)))));


--
-- Name: chamados Authenticated users can view chamados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view chamados" ON public.chamados FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: profiles Authenticated users can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: chamados Service role can insert chamados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert chamados" ON public.chamados FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: chamados Service role can update chamados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can update chamados" ON public.chamados FOR UPDATE TO authenticated USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chamados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;