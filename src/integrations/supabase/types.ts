export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aliases: {
        Row: {
          accepted_privacy_at: string | null
          accepted_privacy_version: string | null
          accepted_terms_at: string | null
          accepted_terms_version: string | null
          birth_day: number
          birth_month: number
          birth_year: number
          created_at: string
          creature: string
          display_name: string
          email_suppressed: boolean
          emoji: string
          emotion: string
          nation: string
          notif_email: string | null
          notif_email_opt_in: boolean
          reengagement_email_sent_at: string | null
          timezone: string
          updated_at: string
          user_id: string
          welcome_email_sent_at: string | null
        }
        Insert: {
          accepted_privacy_at?: string | null
          accepted_privacy_version?: string | null
          accepted_terms_at?: string | null
          accepted_terms_version?: string | null
          birth_day: number
          birth_month: number
          birth_year: number
          created_at?: string
          creature: string
          display_name: string
          email_suppressed?: boolean
          emoji: string
          emotion: string
          nation: string
          notif_email?: string | null
          notif_email_opt_in?: boolean
          reengagement_email_sent_at?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          welcome_email_sent_at?: string | null
        }
        Update: {
          accepted_privacy_at?: string | null
          accepted_privacy_version?: string | null
          accepted_terms_at?: string | null
          accepted_terms_version?: string | null
          birth_day?: number
          birth_month?: number
          birth_year?: number
          created_at?: string
          creature?: string
          display_name?: string
          email_suppressed?: boolean
          emoji?: string
          emotion?: string
          nation?: string
          notif_email?: string | null
          notif_email_opt_in?: boolean
          reengagement_email_sent_at?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      behavioral_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      billing_emails: {
        Row: {
          dedupe_key: string
          id: string
          kind: string
          sent_at: string
          user_id: string
        }
        Insert: {
          dedupe_key: string
          id?: string
          kind: string
          sent_at?: string
          user_id: string
        }
        Update: {
          dedupe_key?: string
          id?: string
          kind?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkin_responses: {
        Row: {
          action: string | null
          alias_id: string
          checkin_id: string
          clean_text: string | null
          created_at: string
          feeling_tap: string | null
          id: string
          rescan: number | null
          resolution: Database["public"]["Enums"]["situation_status"] | null
          situation_id: string
          trajectory: Database["public"]["Enums"]["trajectory"] | null
          would_again: string | null
        }
        Insert: {
          action?: string | null
          alias_id: string
          checkin_id: string
          clean_text?: string | null
          created_at?: string
          feeling_tap?: string | null
          id?: string
          rescan?: number | null
          resolution?: Database["public"]["Enums"]["situation_status"] | null
          situation_id: string
          trajectory?: Database["public"]["Enums"]["trajectory"] | null
          would_again?: string | null
        }
        Update: {
          action?: string | null
          alias_id?: string
          checkin_id?: string
          clean_text?: string | null
          created_at?: string
          feeling_tap?: string | null
          id?: string
          rescan?: number | null
          resolution?: Database["public"]["Enums"]["situation_status"] | null
          situation_id?: string
          trajectory?: Database["public"]["Enums"]["trajectory"] | null
          would_again?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_responses_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_responses_situation_id_fkey"
            columns: ["situation_id"]
            isOneToOne: false
            referencedRelation: "situations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          alias_id: string
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          opened_at: string | null
          responded_at: string | null
          scheduled_at: string
          sent_at: string | null
          situation_id: string
          state: Database["public"]["Enums"]["checkin_state"]
          type: Database["public"]["Enums"]["checkin_type"]
        }
        Insert: {
          alias_id: string
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          opened_at?: string | null
          responded_at?: string | null
          scheduled_at: string
          sent_at?: string | null
          situation_id: string
          state?: Database["public"]["Enums"]["checkin_state"]
          type: Database["public"]["Enums"]["checkin_type"]
        }
        Update: {
          alias_id?: string
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          opened_at?: string | null
          responded_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          situation_id?: string
          state?: Database["public"]["Enums"]["checkin_state"]
          type?: Database["public"]["Enums"]["checkin_type"]
        }
        Relationships: [
          {
            foreignKeyName: "checkins_situation_id_fkey"
            columns: ["situation_id"]
            isOneToOne: false
            referencedRelation: "situations"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_records: {
        Row: {
          author_id: string
          clean_text: string
          created_at: string
          deleted_at: string | null
          edited: boolean
          id: string
          situation_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          clean_text: string
          created_at?: string
          deleted_at?: string | null
          edited?: boolean
          id?: string
          situation_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          clean_text?: string
          created_at?: string
          deleted_at?: string | null
          edited?: boolean
          id?: string
          situation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_records_situation_id_fkey"
            columns: ["situation_id"]
            isOneToOne: false
            referencedRelation: "situations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          alias_id: string
          clean_text: string
          created_at: string
          deleted_at: string | null
          edited: boolean
          id: string
          is_companion: boolean
          room_id: string
          updated_at: string
        }
        Insert: {
          alias_id: string
          clean_text: string
          created_at?: string
          deleted_at?: string | null
          edited?: boolean
          id?: string
          is_companion?: boolean
          room_id: string
          updated_at?: string
        }
        Update: {
          alias_id?: string
          clean_text?: string
          created_at?: string
          deleted_at?: string | null
          edited?: boolean
          id?: string
          is_companion?: boolean
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_events: {
        Row: {
          alias_id: string | null
          category: string
          created_at: string
          id: string
          resources_shown: boolean
          severity: string
          situation_id: string | null
        }
        Insert: {
          alias_id?: string | null
          category: string
          created_at?: string
          id?: string
          resources_shown?: boolean
          severity: string
          situation_id?: string | null
        }
        Update: {
          alias_id?: string | null
          category?: string
          created_at?: string
          id?: string
          resources_shown?: boolean
          severity?: string
          situation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crisis_events_situation_id_fkey"
            columns: ["situation_id"]
            isOneToOne: false
            referencedRelation: "situations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          id: string
          name: string
          properties: Json
          session_id: string | null
          ts: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          properties?: Json
          session_id?: string | null
          ts?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          properties?: Json
          session_id?: string | null
          ts?: string
          user_id?: string | null
        }
        Relationships: []
      }
      feedback_events: {
        Row: {
          alias: string | null
          created_at: string
          id: string
          intent: string | null
          kind: string | null
          label: string | null
          mode: string | null
          note: string | null
          page: string | null
          payload: Json | null
          score: number | null
          sec: number | null
          sid: string | null
          signature: string | null
          t: string
          target: string | null
          text: string | null
          trigger: string | null
          type: string
          v: string
        }
        Insert: {
          alias?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          kind?: string | null
          label?: string | null
          mode?: string | null
          note?: string | null
          page?: string | null
          payload?: Json | null
          score?: number | null
          sec?: number | null
          sid?: string | null
          signature?: string | null
          t?: string
          target?: string | null
          text?: string | null
          trigger?: string | null
          type: string
          v: string
        }
        Update: {
          alias?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          kind?: string | null
          label?: string | null
          mode?: string | null
          note?: string | null
          page?: string | null
          payload?: Json | null
          score?: number | null
          sec?: number | null
          sid?: string | null
          signature?: string | null
          t?: string
          target?: string | null
          text?: string | null
          trigger?: string | null
          type?: string
          v?: string
        }
        Relationships: []
      }
      joke_cards: {
        Row: {
          angle: string
          card_text: string
          corpus_eligible: boolean
          created_at: string
          id: string
          is_seed: boolean
          judge_score: number | null
          position: number
          room_id: string | null
          set_id: string
          updated_at: string
          used_fallback: boolean
          user_id: string | null
        }
        Insert: {
          angle: string
          card_text: string
          corpus_eligible?: boolean
          created_at?: string
          id?: string
          is_seed?: boolean
          judge_score?: number | null
          position?: number
          room_id?: string | null
          set_id: string
          updated_at?: string
          used_fallback?: boolean
          user_id?: string | null
        }
        Update: {
          angle?: string
          card_text?: string
          corpus_eligible?: boolean
          created_at?: string
          id?: string
          is_seed?: boolean
          judge_score?: number | null
          position?: number
          room_id?: string | null
          set_id?: string
          updated_at?: string
          used_fallback?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "joke_cards_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "joke_cards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "joke_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      joke_deal_slots: {
        Row: {
          created_at: string
          position: number
          set_id: string
        }
        Insert: {
          created_at?: string
          position: number
          set_id: string
        }
        Update: {
          created_at?: string
          position?: number
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "joke_deal_slots_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "joke_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      joke_flips: {
        Row: {
          created_at: string
          day: string
          flips_used: number
          grant_consumed: boolean
          grant_position: number | null
          grant_set_id: string | null
          set_ids: string[]
          sets_flipped: number
          subject_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          flips_used?: number
          grant_consumed?: boolean
          grant_position?: number | null
          grant_set_id?: string | null
          set_ids?: string[]
          sets_flipped?: number
          subject_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          flips_used?: number
          grant_consumed?: boolean
          grant_position?: number | null
          grant_set_id?: string | null
          set_ids?: string[]
          sets_flipped?: number
          subject_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      joke_sets: {
        Row: {
          angles: string[]
          anon_session_id: string | null
          archetype: string
          clean_text: string
          corpus_eligible: boolean
          created_at: string
          id: string
          is_seed: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          angles?: string[]
          anon_session_id?: string | null
          archetype?: string
          clean_text: string
          corpus_eligible?: boolean
          created_at?: string
          id?: string
          is_seed?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          angles?: string[]
          anon_session_id?: string | null
          archetype?: string
          clean_text?: string
          corpus_eligible?: boolean
          created_at?: string
          id?: string
          is_seed?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mirror_onboarding: {
        Row: {
          created_at: string
          onboarded_at: string
          source: string
          updated_at: string
          user_id: string
          welcome_email_sent_at: string | null
        }
        Insert: {
          created_at?: string
          onboarded_at?: string
          source?: string
          updated_at?: string
          user_id: string
          welcome_email_sent_at?: string | null
        }
        Update: {
          created_at?: string
          onboarded_at?: string
          source?: string
          updated_at?: string
          user_id?: string
          welcome_email_sent_at?: string | null
        }
        Relationships: []
      }
      mirror_patterns: {
        Row: {
          count: number
          created_at: string
          depth: number
          district: string
          embedding: string | null
          emoji: string
          first_seen: string
          id: string
          insight: string
          is_demo: boolean
          is_seed: boolean
          last_seen: string
          name: string
          position: Json | null
          punch: string
          rarity: string
          record: string
          sources: Json
          state: string
          trend: number[]
          trend_dir: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          count?: number
          created_at?: string
          depth?: number
          district?: string
          embedding?: string | null
          emoji?: string
          first_seen?: string
          id?: string
          insight?: string
          is_demo?: boolean
          is_seed?: boolean
          last_seen?: string
          name?: string
          position?: Json | null
          punch?: string
          rarity?: string
          record?: string
          sources?: Json
          state?: string
          trend?: number[]
          trend_dir?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          count?: number
          created_at?: string
          depth?: number
          district?: string
          embedding?: string | null
          emoji?: string
          first_seen?: string
          id?: string
          insight?: string
          is_demo?: boolean
          is_seed?: boolean
          last_seen?: string
          name?: string
          position?: Json | null
          punch?: string
          rarity?: string
          record?: string
          sources?: Json
          state?: string
          trend?: number[]
          trend_dir?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mirror_sessions: {
        Row: {
          created_at: string
          id: string
          turns: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          turns?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          turns?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mirror_shape: {
        Row: {
          at: string
          history: Json
          line: string
          movement: string
          shape: string
          updated_at: string
          user_id: string
        }
        Insert: {
          at?: string
          history?: Json
          line?: string
          movement?: string
          shape: string
          updated_at?: string
          user_id: string
        }
        Update: {
          at?: string
          history?: Json
          line?: string
          movement?: string
          shape?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mirror_signals: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          is_seed: boolean
          pattern_id: string | null
          ref_id: string
          source: string
          text_scrubbed: string
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          is_seed?: boolean
          pattern_id?: string | null
          ref_id: string
          source: string
          text_scrubbed?: string
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          is_seed?: boolean
          pattern_id?: string | null
          ref_id?: string
          source?: string
          text_scrubbed?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mirror_signals_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "mirror_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      outcomes: {
        Row: {
          alias_id: string
          captured_at: string
          decision_summary: string
          id: string
          is_seed: boolean
          resolution: Database["public"]["Enums"]["situation_status"]
          situation_id: string
          trajectory_curve: Json
          would_again: string | null
        }
        Insert: {
          alias_id: string
          captured_at?: string
          decision_summary: string
          id?: string
          is_seed?: boolean
          resolution: Database["public"]["Enums"]["situation_status"]
          situation_id: string
          trajectory_curve?: Json
          would_again?: string | null
        }
        Update: {
          alias_id?: string
          captured_at?: string
          decision_summary?: string
          id?: string
          is_seed?: boolean
          resolution?: Database["public"]["Enums"]["situation_status"]
          situation_id?: string
          trajectory_curve?: Json
          would_again?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcomes_situation_id_fkey"
            columns: ["situation_id"]
            isOneToOne: true
            referencedRelation: "situations"
            referencedColumns: ["id"]
          },
        ]
      }
      pii_scrub_log: {
        Row: {
          alias_id: string | null
          count: number
          created_at: string
          detected_type: string
          id: number
          replacement_token: string
          situation_id: string | null
        }
        Insert: {
          alias_id?: string | null
          count?: number
          created_at?: string
          detected_type: string
          id?: number
          replacement_token: string
          situation_id?: string | null
        }
        Update: {
          alias_id?: string | null
          count?: number
          created_at?: string
          detected_type?: string
          id?: number
          replacement_token?: string
          situation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pii_scrub_log_situation_id_fkey"
            columns: ["situation_id"]
            isOneToOne: false
            referencedRelation: "situations"
            referencedColumns: ["id"]
          },
        ]
      }
      pillar_status: {
        Row: {
          opened_at: string | null
          pillar: string
          real_story_floor: number
          sla_target_minutes: number
          updated_at: string
        }
        Insert: {
          opened_at?: string | null
          pillar: string
          real_story_floor?: number
          sla_target_minutes?: number
          updated_at?: string
        }
        Update: {
          opened_at?: string | null
          pillar?: string
          real_story_floor?: number
          sla_target_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          companion_seen_at: string | null
          created_at: string
          email: string | null
          email_prefs_token: string | null
          first_name: string | null
          first_visit_at: string
          full_name: string | null
          is_anonymous: boolean
          last_city: string | null
          last_country: string | null
          last_login_at: string | null
          last_name: string | null
          last_user_agent: string | null
          last_visit_at: string
          login_count: number
          notif_all_opt_out: boolean
          notif_checkins_opt_out: boolean
          notif_community_opt_out: boolean
          notif_digest_opt_out: boolean
          provider: string | null
          signup_at: string | null
          updated_at: string
          user_id: string
          visit_count: number
        }
        Insert: {
          avatar_url?: string | null
          companion_seen_at?: string | null
          created_at?: string
          email?: string | null
          email_prefs_token?: string | null
          first_name?: string | null
          first_visit_at?: string
          full_name?: string | null
          is_anonymous?: boolean
          last_city?: string | null
          last_country?: string | null
          last_login_at?: string | null
          last_name?: string | null
          last_user_agent?: string | null
          last_visit_at?: string
          login_count?: number
          notif_all_opt_out?: boolean
          notif_checkins_opt_out?: boolean
          notif_community_opt_out?: boolean
          notif_digest_opt_out?: boolean
          provider?: string | null
          signup_at?: string | null
          updated_at?: string
          user_id: string
          visit_count?: number
        }
        Update: {
          avatar_url?: string | null
          companion_seen_at?: string | null
          created_at?: string
          email?: string | null
          email_prefs_token?: string | null
          first_name?: string | null
          first_visit_at?: string
          full_name?: string | null
          is_anonymous?: boolean
          last_city?: string | null
          last_country?: string | null
          last_login_at?: string | null
          last_name?: string | null
          last_user_agent?: string | null
          last_visit_at?: string
          login_count?: number
          notif_all_opt_out?: boolean
          notif_checkins_opt_out?: boolean
          notif_community_opt_out?: boolean
          notif_digest_opt_out?: boolean
          provider?: string | null
          signup_at?: string | null
          updated_at?: string
          user_id?: string
          visit_count?: number
        }
        Relationships: []
      }
      room_reactions: {
        Row: {
          created_at: string
          kind: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_reactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_relates: {
        Row: {
          created_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_relates_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          alias: string
          author_id: string
          body: string
          created_at: string
          emoji: string
          hall: string
          id: string
          reflection: string | null
          source: string
          support: string
          title: string
          updated_at: string
        }
        Insert: {
          alias: string
          author_id: string
          body: string
          created_at?: string
          emoji: string
          hall: string
          id?: string
          reflection?: string | null
          source?: string
          support: string
          title: string
          updated_at?: string
        }
        Update: {
          alias?: string
          author_id?: string
          body?: string
          created_at?: string
          emoji?: string
          hall?: string
          id?: string
          reflection?: string | null
          source?: string
          support?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      situations: {
        Row: {
          alias_id: string
          arc: Json | null
          body: string | null
          clean_text: string
          created_at: string
          crisis_flag: boolean
          deleted_at: string | null
          edited: boolean
          embedding: string | null
          emotional_core: string | null
          factors: string[] | null
          human_response_at: string | null
          id: string
          initial_scan: number | null
          is_public: boolean
          is_seed: boolean
          kind: string | null
          pillar: Database["public"]["Enums"]["situation_pillar"]
          read: string | null
          reflection: string | null
          resolved_at: string | null
          room_id: string | null
          scan_band: Database["public"]["Enums"]["scan_band"] | null
          scan_basis: string | null
          scan_corpus_n: number | null
          scan_cultural_note: string | null
          scan_factors: string[]
          scan_read: string | null
          scan_reasoning: Json | null
          scan_signature: string | null
          signature: string | null
          slug: string | null
          status: Database["public"]["Enums"]["situation_status"]
          support_mode: string | null
          tags: string[]
          the_real_thing: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          alias_id: string
          arc?: Json | null
          body?: string | null
          clean_text: string
          created_at?: string
          crisis_flag?: boolean
          deleted_at?: string | null
          edited?: boolean
          embedding?: string | null
          emotional_core?: string | null
          factors?: string[] | null
          human_response_at?: string | null
          id?: string
          initial_scan?: number | null
          is_public?: boolean
          is_seed?: boolean
          kind?: string | null
          pillar: Database["public"]["Enums"]["situation_pillar"]
          read?: string | null
          reflection?: string | null
          resolved_at?: string | null
          room_id?: string | null
          scan_band?: Database["public"]["Enums"]["scan_band"] | null
          scan_basis?: string | null
          scan_corpus_n?: number | null
          scan_cultural_note?: string | null
          scan_factors?: string[]
          scan_read?: string | null
          scan_reasoning?: Json | null
          scan_signature?: string | null
          signature?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["situation_status"]
          support_mode?: string | null
          tags?: string[]
          the_real_thing?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          alias_id?: string
          arc?: Json | null
          body?: string | null
          clean_text?: string
          created_at?: string
          crisis_flag?: boolean
          deleted_at?: string | null
          edited?: boolean
          embedding?: string | null
          emotional_core?: string | null
          factors?: string[] | null
          human_response_at?: string | null
          id?: string
          initial_scan?: number | null
          is_public?: boolean
          is_seed?: boolean
          kind?: string | null
          pillar?: Database["public"]["Enums"]["situation_pillar"]
          read?: string | null
          reflection?: string | null
          resolved_at?: string | null
          room_id?: string | null
          scan_band?: Database["public"]["Enums"]["scan_band"] | null
          scan_basis?: string | null
          scan_corpus_n?: number | null
          scan_cultural_note?: string | null
          scan_factors?: string[]
          scan_read?: string | null
          scan_reasoning?: Json | null
          scan_signature?: string | null
          signature?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["situation_status"]
          support_mode?: string | null
          tags?: string[]
          the_real_thing?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "situations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_patterns: {
        Row: {
          alias_id: string
          id: string
          support: number
          tendency: string
          trigger: string
          updated_at: string
          what_helps: string | null
        }
        Insert: {
          alias_id: string
          id?: string
          support?: number
          tendency: string
          trigger: string
          updated_at?: string
          what_helps?: string | null
        }
        Update: {
          alias_id?: string
          id?: string
          support?: number
          tendency?: string
          trigger?: string
          updated_at?: string
          what_helps?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          city: string | null
          country: string | null
          id: string
          is_revisit: boolean
          landing_path: string | null
          path: string | null
          referrer: string | null
          session_id: string
          started_at: string
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string
          is_revisit?: boolean
          landing_path?: string | null
          path?: string | null
          referrer?: string | null
          session_id: string
          started_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string
          is_revisit?: boolean
          landing_path?: string | null
          path?: string | null
          referrer?: string | null
          session_id?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      visits_classified: {
        Row: {
          city: string | null
          country: string | null
          id: string | null
          is_bot: boolean | null
          is_revisit: boolean | null
          landing_path: string | null
          path: string | null
          referrer: string | null
          session_id: string | null
          started_at: string | null
          user_agent: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string | null
          is_bot?: never
          is_revisit?: boolean | null
          landing_path?: string | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          started_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string | null
          is_bot?: never
          is_revisit?: boolean | null
          landing_path?: string | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          started_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_active_users: {
        Args: never
        Returns: {
          dau: number
          mau: number
          wau: number
        }[]
      }
      admin_country_counts: {
        Args: never
        Returns: {
          cnt: number
          country: string
        }[]
      }
      admin_event_counts: {
        Args: never
        Returns: {
          d30: number
          d7: number
          name: string
        }[]
      }
      admin_provider_counts: {
        Args: never
        Returns: {
          cnt: number
          provider: string
        }[]
      }
      alias_public: {
        Args: { _user_id: string }
        Returns: {
          display_name: string
          emoji: string
          user_id: string
        }[]
      }
      cancel_pending_checkins: {
        Args: { _situation_id: string }
        Returns: undefined
      }
      get_user_stats: {
        Args: { _user_id: string }
        Returns: {
          comments: number
          reactions: number
          spills: number
        }[]
      }
      has_active_mirror: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_situations: {
        Args: {
          match_count?: number
          match_pillar?: string
          query_embedding: string
          similarity_floor?: number
        }
        Returns: {
          clean_text: string
          created_at: string
          id: string
          pillar: string
          similarity: number
        }[]
      }
      match_user_patterns: {
        Args: {
          match_count?: number
          p_user: string
          q: string
          similarity_floor?: number
        }
        Returns: {
          district: string
          id: string
          name: string
          similarity: number
        }[]
      }
      mirror_depth_for: { Args: { _count: number }; Returns: number }
      recompute_mirror_evolution: {
        Args: { _decay_days?: number }
        Returns: undefined
      }
      schedule_checkins: {
        Args: { p_alias_id: string; p_situation_id: string }
        Returns: undefined
      }
      situations_slugify: { Args: { _text: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      checkin_state:
        | "scheduled"
        | "sent"
        | "opened"
        | "responded"
        | "suppressed"
        | "snoozed"
        | "muted"
        | "failed"
      checkin_type:
        | "day0"
        | "day1"
        | "day2"
        | "day3"
        | "day7"
        | "day14"
        | "adaptive30"
      scan_band: "quiet" | "real" | "hot" | "heavy" | "serious"
      situation_pillar: "relationships" | "marriage" | "family" | "career"
      situation_status:
        | "in_progress"
        | "resolved"
        | "avoided"
        | "worse"
        | "deleted"
        | "abandoned"
        | "open"
      trajectory: "better" | "same" | "worse"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      checkin_state: [
        "scheduled",
        "sent",
        "opened",
        "responded",
        "suppressed",
        "snoozed",
        "muted",
        "failed",
      ],
      checkin_type: [
        "day0",
        "day1",
        "day2",
        "day3",
        "day7",
        "day14",
        "adaptive30",
      ],
      scan_band: ["quiet", "real", "hot", "heavy", "serious"],
      situation_pillar: ["relationships", "marriage", "family", "career"],
      situation_status: [
        "in_progress",
        "resolved",
        "avoided",
        "worse",
        "deleted",
        "abandoned",
        "open",
      ],
      trajectory: ["better", "same", "worse"],
    },
  },
} as const
