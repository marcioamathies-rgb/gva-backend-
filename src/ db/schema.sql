-- GVA Full Schema v2
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('super_admin','moderator','member'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('pending','active','expired','suspended','under_review'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scholarship_status AS ENUM ('submitted','under_review','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE vote_category AS ENUM ('president','vice_president','secretary','treasurer','chaplain','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE complaint_status AS ENUM ('open','under_review','resolved','dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE doc_category AS ENUM ('policy','form','financial','minutes','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_type AS ENUM ('dues','donation','contribution','withdrawal','earning'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS system_settings (id SMALLINT PRIMARY KEY DEFAULT 1, setup_completed BOOLEAN NOT NULL DEFAULT FALSE, org_name TEXT NOT NULL DEFAULT 'Greater Vision Association (GVA)', monetization_enabled BOOLEAN NOT NULL DEFAULT FALSE, stripe_account_id TEXT, auto_like_count INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT single_row CHECK (id=1));
INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cms_content (page_key TEXT PRIMARY KEY, content JSONB NOT NULL DEFAULT '{}'::jsonb, updated_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO cms_content (page_key,content) VALUES ('homepage','{"hero_title":"A wider view of what a community can build together."}'),('about','{"body":"Founded March 12, 2025 in Monrovia, Liberia."}'),('contact','{"phone1":"+231 775 302 558","email":"gva.lrorg@gmail.com"}'),('banners','{"items":[]}') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, username TEXT UNIQUE, password_hash TEXT NOT NULL, role user_role NOT NULL, status user_status NOT NULL DEFAULT 'pending', must_change_password BOOLEAN NOT NULL DEFAULT FALSE, failed_login_attempts INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS members (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, membership_id TEXT UNIQUE, full_name TEXT NOT NULL, profile_photo_url TEXT, bio TEXT, date_of_birth DATE, gender TEXT, nationality TEXT, occupation TEXT, skills TEXT, phone TEXT, current_address TEXT, father_name TEXT, mother_name TEXT, father_status TEXT DEFAULT 'living', mother_status TEXT DEFAULT 'living', fee_payer TEXT, join_date DATE, expiry_date DATE, monetization_enabled BOOLEAN NOT NULL DEFAULT FALSE, monetization_eligible_at TIMESTAMPTZ, stripe_connect_account TEXT, qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'));
CREATE INDEX IF NOT EXISTS idx_members_membership_id ON members(membership_id);
CREATE INDEX IF NOT EXISTS idx_members_expiry ON members(expiry_date);

CREATE TABLE IF NOT EXISTS emergency_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_user_id UUID NOT NULL REFERENCES members(user_id) ON DELETE CASCADE, contact_order SMALLINT NOT NULL CHECK (contact_order IN (1,2)), name TEXT, relationship TEXT, phone TEXT, UNIQUE (member_user_id,contact_order));

CREATE TABLE IF NOT EXISTS posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT, image_url TEXT, auto_liked_count INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS post_likes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, is_auto_like BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (post_id,user_id));
CREATE TABLE IF NOT EXISTS post_comments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS post_shares (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS gallery_images (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submitted_by UUID REFERENCES users(id) ON DELETE SET NULL, url TEXT NOT NULL, thumbnail_url TEXT, caption TEXT, approved BOOLEAN NOT NULL DEFAULT FALSE, approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS voting_elections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, description TEXT, start_date TIMESTAMPTZ NOT NULL DEFAULT now(), end_date TIMESTAMPTZ NOT NULL, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS voting_candidates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), election_id UUID NOT NULL REFERENCES voting_elections(id) ON DELETE CASCADE, member_user_id UUID NOT NULL REFERENCES users(id), category vote_category NOT NULL, manifesto TEXT, added_by UUID REFERENCES users(id));
CREATE TABLE IF NOT EXISTS votes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), election_id UUID NOT NULL REFERENCES voting_elections(id) ON DELETE CASCADE, candidate_id UUID NOT NULL REFERENCES voting_candidates(id), voter_user_id UUID NOT NULL REFERENCES users(id), category vote_category NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (election_id,voter_user_id,category));

CREATE TABLE IF NOT EXISTS documents (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, description TEXT, file_url TEXT NOT NULL, category doc_category NOT NULL DEFAULT 'other', uploaded_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS complaints (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), complainant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, subject_user_id UUID REFERENCES users(id) ON DELETE SET NULL, subject_name TEXT, subject_membership_id TEXT, description TEXT NOT NULL, status complaint_status NOT NULL DEFAULT 'open', reviewed_by UUID REFERENCES users(id), resolution_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS scholarship_programs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, description TEXT, requirements TEXT, capacity INTEGER, deadline DATE NOT NULL, award TEXT, fee NUMERIC(10,2) NOT NULL DEFAULT 0, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS scholarship_applications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), application_ref TEXT UNIQUE NOT NULL, program_id UUID REFERENCES scholarship_programs(id) ON DELETE SET NULL, member_user_id UUID REFERENCES users(id) ON DELETE SET NULL, applicant_name TEXT, phone TEXT NOT NULL, email TEXT NOT NULL, current_address TEXT, skills TEXT, occupation TEXT, nationality TEXT, fee_payer TEXT, father_name TEXT, mother_name TEXT, father_status TEXT, mother_status TEXT, school_name TEXT NOT NULL, education_level TEXT NOT NULL, field_of_study TEXT, financial_need_statement TEXT, emergency_contact_1 JSONB, emergency_contact_2 JSONB, status scholarship_status NOT NULL DEFAULT 'submitted', reviewer_notes TEXT, reviewed_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS chat_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room TEXT NOT NULL DEFAULT 'gva-community', user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT, attachment_url TEXT, reply_to_id UUID REFERENCES chat_messages(id), pinned BOOLEAN NOT NULL DEFAULT FALSE, deleted BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room,created_at);
CREATE TABLE IF NOT EXISTS chat_mutes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, muted_by UUID REFERENCES users(id), muted_until TIMESTAMPTZ, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS chat_room_state (room TEXT PRIMARY KEY DEFAULT 'gva-community', locked BOOLEAN NOT NULL DEFAULT FALSE, locked_by UUID REFERENCES users(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO chat_room_state (room) VALUES ('gva-community') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS member_connections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (requester_id,addressee_id));
CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, type TEXT NOT NULL, message TEXT NOT NULL, link TEXT, read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS finance_transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), member_user_id UUID REFERENCES users(id) ON DELETE SET NULL, type transaction_type NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK (amount>=0), currency TEXT NOT NULL DEFAULT 'USD', stripe_payment_intent_id TEXT, occurred_on DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, recorded_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, description TEXT, location TEXT, start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id UUID REFERENCES users(id), action TEXT NOT NULL, target_type TEXT, target_id TEXT, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_users_updated ON users; CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_complaints_updated ON complaints; CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_scholarship_updated ON scholarship_applications; CREATE TRIGGER trg_scholarship_updated BEFORE UPDATE ON scholarship_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Member profiles (extended public info)
CREATE TABLE IF NOT EXISTS member_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cover_photo_url TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
