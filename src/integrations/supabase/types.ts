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
      account_verification_checks: {
        Row: {
          audit_flags: Json
          checked_at: string
          id: string
          lifetime_hours: number | null
          provider: string
          user_id: string
        }
        Insert: {
          audit_flags?: Json
          checked_at?: string
          id?: string
          lifetime_hours?: number | null
          provider: string
          user_id: string
        }
        Update: {
          audit_flags?: Json
          checked_at?: string
          id?: string
          lifetime_hours?: number | null
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_events: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          payload: Json | null
          subject_id: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["activity_kind"]
          payload?: Json | null
          subject_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          payload?: Json | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string
          hour: number
          id: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          hour: number
          id?: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          hour?: number
          id?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      badges: {
        Row: {
          description: string
          icon: string
          key: string
          label: string
          tier: string
        }
        Insert: {
          description: string
          icon: string
          key: string
          label: string
          tier?: string
        }
        Update: {
          description?: string
          icon?: string
          key?: string
          label?: string
          tier?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          challenger_id: string
          created_at: string
          format: string | null
          game: string
          id: string
          notes: string | null
          opponent_id: string
          rake_pct: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["challenge_status"]
          updated_at: string
          wager_points: number
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          created_at?: string
          format?: string | null
          game: string
          id?: string
          notes?: string | null
          opponent_id: string
          rake_pct?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
          updated_at?: string
          wager_points?: number
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          created_at?: string
          format?: string | null
          game?: string
          id?: string
          notes?: string | null
          opponent_id?: string
          rake_pct?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
          updated_at?: string
          wager_points?: number
          winner_id?: string | null
        }
        Relationships: []
      }
      clan_invites: {
        Row: {
          clan_id: string
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_invites_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_members: {
        Row: {
          clan_id: string
          joined_at: string
          role: Database["public"]["Enums"]["clan_role"]
          user_id: string
        }
        Insert: {
          clan_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["clan_role"]
          user_id: string
        }
        Update: {
          clan_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["clan_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          elo: number
          id: string
          max_members: number
          member_count: number
          name: string
          owner_id: string
          tag: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          elo?: number
          id?: string
          max_members?: number
          member_count?: number
          name: string
          owner_id: string
          tag: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          elo?: number
          id?: string
          max_members?: number
          member_count?: number
          name?: string
          owner_id?: string
          tag?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_channels: {
        Row: {
          club_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          club_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_channels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_messages: {
        Row: {
          attachment_url: string | null
          body: string
          channel_id: string
          club_id: string
          created_at: string
          id: string
          pinned: boolean
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          channel_id: string
          club_id: string
          created_at?: string
          id?: string
          pinned?: boolean
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          channel_id?: string
          club_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "club_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_wars: {
        Row: {
          challenger_club_id: string
          created_at: string
          created_by: string
          defender_club_id: string
          ends_at: string | null
          format: string
          game_title: string
          id: string
          ruleset: string
          starts_at: string | null
          status: string
          updated_at: string
          wager_pool: number
          winner_club_id: string | null
        }
        Insert: {
          challenger_club_id: string
          created_at?: string
          created_by: string
          defender_club_id: string
          ends_at?: string | null
          format?: string
          game_title: string
          id?: string
          ruleset: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          wager_pool?: number
          winner_club_id?: string | null
        }
        Update: {
          challenger_club_id?: string
          created_at?: string
          created_by?: string
          defender_club_id?: string
          ends_at?: string | null
          format?: string
          game_title?: string
          id?: string
          ruleset?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          wager_pool?: number
          winner_club_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_wars_challenger_club_id_fkey"
            columns: ["challenger_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_wars_defender_club_id_fkey"
            columns: ["defender_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_wars_winner_club_id_fkey"
            columns: ["winner_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          accent: string | null
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          member_count: number
          name: string
          owner_id: string
          tag: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent?: string | null
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number
          name: string
          owner_id: string
          tag?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent?: string | null
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number
          name?: string
          owner_id?: string
          tag?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      cosmetic_unlocks: {
        Row: {
          cosmetic_key: string
          cost_paid: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cosmetic_key: string
          cost_paid?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cosmetic_key?: string
          cost_paid?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      crew_event_rsvps: {
        Row: {
          event_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crew_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_events: {
        Row: {
          clan_id: string
          created_at: string
          game: string | null
          id: string
          notes: string | null
          organizer_id: string
          starts_at: string
          title: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          game?: string | null
          id?: string
          notes?: string | null
          organizer_id: string
          starts_at: string
          title: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          game?: string | null
          id?: string
          notes?: string | null
          organizer_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_events_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount: number
          challenge_id: string | null
          created_at: string
          id: string
          settled_at: string | null
          status: Database["public"]["Enums"]["escrow_status"]
          user_id: string
        }
        Insert: {
          amount: number
          challenge_id?: string | null
          created_at?: string
          id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          user_id: string
        }
        Update: {
          amount?: number
          challenge_id?: string | null
          created_at?: string
          id?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          category: string
          created_at: string
          icon_url: string | null
          id: string
          is_active: boolean
          lookup_key: string
          name: string
          popularity: number
          publisher: string | null
          riot_game_key: string | null
          steam_app_id: number | null
          tracker_gg_slug: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          lookup_key: string
          name: string
          popularity?: number
          publisher?: string | null
          riot_game_key?: string | null
          steam_app_id?: number | null
          tracker_gg_slug?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          lookup_key?: string
          name?: string
          popularity?: number
          publisher?: string | null
          riot_game_key?: string | null
          steam_app_id?: number | null
          tracker_gg_slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          audit_flags: Json
          id: string
          metric: string
          recorded_at: string
          tournament_id: string
          user_id: string
          value: number
        }
        Insert: {
          audit_flags?: Json
          id?: string
          metric: string
          recorded_at?: string
          tournament_id: string
          user_id: string
          value?: number
        }
        Update: {
          audit_flags?: Json
          id?: string
          metric?: string
          recorded_at?: string
          tournament_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_payout"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "leaderboard_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      lfg_ad_joiners: {
        Row: {
          ad_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          ad_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_ad_joiners_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "lfg_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      lfg_ad_views: {
        Row: {
          ad_owner_id: string
          created_at: string
          id: string
          viewer_id: string | null
        }
        Insert: {
          ad_owner_id: string
          created_at?: string
          id?: string
          viewer_id?: string | null
        }
        Update: {
          ad_owner_id?: string
          created_at?: string
          id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lfg_ad_views_ad_owner_id_fkey"
            columns: ["ad_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lfg_ad_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lfg_ads: {
        Row: {
          closed_at: string | null
          created_at: string
          description: string | null
          expires_at: string
          game: string
          host_id: string
          id: string
          mic_required: boolean
          min_rank: string | null
          mode: string | null
          region: string | null
          slots_filled: number
          slots_total: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          game: string
          host_id: string
          id?: string
          mic_required?: boolean
          min_rank?: string | null
          mode?: string | null
          region?: string | null
          slots_filled?: number
          slots_total?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          game?: string
          host_id?: string
          id?: string
          mic_required?: boolean
          min_rank?: string | null
          mode?: string | null
          region?: string | null
          slots_filled?: number
          slots_total?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      lfg_boosts: {
        Row: {
          expires_at: string
          id: string
          starts_at: string
          tokens_spent: number
          user_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          starts_at?: string
          tokens_spent?: number
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          starts_at?: string
          tokens_spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lfg_boosts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      linked_accounts: {
        Row: {
          aggregated_stats: Json
          created_at: string
          current_rank_display: string | null
          external_uid: string | null
          gamertag: string
          id: number
          platform: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          aggregated_stats?: Json
          created_at?: string
          current_rank_display?: string | null
          external_uid?: string | null
          gamertag: string
          id?: number
          platform: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          aggregated_stats?: Json
          created_at?: string
          current_rank_display?: string | null
          external_uid?: string | null
          gamertag?: string
          id?: number
          platform?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "linked_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_streaks: {
        Row: {
          current_streak: number
          last_login_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_login_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_login_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      media_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      media_posts: {
        Row: {
          body: string | null
          created_at: string
          duration_s: number | null
          game: string | null
          id: string
          kind: string
          media_path: string | null
          size_bytes: number | null
          source_url: string | null
          title: string | null
          tokens_spent: number
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          duration_s?: number | null
          game?: string | null
          id?: string
          kind: string
          media_path?: string | null
          size_bytes?: number | null
          source_url?: string | null
          title?: string | null
          tokens_spent?: number
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          duration_s?: number | null
          game?: string | null
          id?: string
          kind?: string
          media_path?: string | null
          size_bytes?: number | null
          source_url?: string | null
          title?: string | null
          tokens_spent?: number
          user_id?: string
        }
        Relationships: []
      }
      media_reposts: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      media_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "media_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          created_at: string
          id: string
          mentioned_id: string
          mentioner_id: string
          source_id: string
          source_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_id: string
          mentioner_id: string
          source_id: string
          source_type: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_id?: string
          mentioner_id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentions_mentioned_id_fkey"
            columns: ["mentioned_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_mentioner_id_fkey"
            columns: ["mentioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          payload: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_grants: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          environment: string
          id: string
          kind: string
          metadata: Json | null
          price_id: string
          stripe_session_id: string
          tokens_granted: number | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          environment?: string
          id?: string
          kind: string
          metadata?: Json | null
          price_id: string
          stripe_session_id: string
          tokens_granted?: number | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          environment?: string
          id?: string
          kind?: string
          metadata?: Json | null
          price_id?: string
          stripe_session_id?: string
          tokens_granted?: number | null
          user_id?: string
        }
        Relationships: []
      }
      play_sessions: {
        Row: {
          ended_at: string | null
          game: string | null
          id: string
          kind: Database["public"]["Enums"]["play_session_kind"]
          started_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          ended_at?: string | null
          game?: string | null
          id?: string
          kind: Database["public"]["Enums"]["play_session_kind"]
          started_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          ended_at?: string | null
          game?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["play_session_kind"]
          started_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_sessions_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_sessions_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats_cache: {
        Row: {
          created_at: string
          expires_at: string
          fetched_at: string
          game_key: string
          headshot_pct: number | null
          hours_played: number | null
          id: string
          kd: number | null
          longest_streak: number | null
          rank_tier: string | null
          raw: Json | null
          source: string
          updated_at: string
          user_id: string
          win_rate: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          game_key: string
          headshot_pct?: number | null
          hours_played?: number | null
          id?: string
          kd?: number | null
          longest_streak?: number | null
          rank_tier?: string | null
          raw?: Json | null
          source: string
          updated_at?: string
          user_id: string
          win_rate?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          game_key?: string
          headshot_pct?: number | null
          hours_played?: number | null
          id?: string
          kd?: number | null
          longest_streak?: number | null
          rank_tier?: string | null
          raw?: Json | null
          source?: string
          updated_at?: string
          user_id?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_cache_game_key_fkey"
            columns: ["game_key"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["lookup_key"]
          },
        ]
      }
      profile_swipes: {
        Row: {
          created_at: string
          direction: string
          swiper_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          swiper_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          swiper_id?: string
          target_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          availability_status: string
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          current_game_activity: string | null
          customization_options: Json
          date_of_birth: string | null
          display_name: string | null
          dm_policy: string
          email_verified_at: string | null
          gender: string | null
          id: string
          is_public: boolean
          lfg_body: string | null
          lfg_games: string[]
          lfg_title: string | null
          onboarded_at: string | null
          playing_hours: Json
          playstyle_badges: string[]
          pro_until: string | null
          rep_score: number
          show_availability: boolean
          timezone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          age?: number | null
          availability_status?: string
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          current_game_activity?: string | null
          customization_options?: Json
          date_of_birth?: string | null
          display_name?: string | null
          dm_policy?: string
          email_verified_at?: string | null
          gender?: string | null
          id: string
          is_public?: boolean
          lfg_body?: string | null
          lfg_games?: string[]
          lfg_title?: string | null
          onboarded_at?: string | null
          playing_hours?: Json
          playstyle_badges?: string[]
          pro_until?: string | null
          rep_score?: number
          show_availability?: boolean
          timezone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          age?: number | null
          availability_status?: string
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          current_game_activity?: string | null
          customization_options?: Json
          date_of_birth?: string | null
          display_name?: string | null
          dm_policy?: string
          email_verified_at?: string | null
          gender?: string | null
          id?: string
          is_public?: boolean
          lfg_body?: string | null
          lfg_games?: string[]
          lfg_title?: string | null
          onboarded_at?: string | null
          playing_hours?: Json
          playstyle_badges?: string[]
          pro_until?: string | null
          rep_score?: number
          show_availability?: boolean
          timezone?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          action: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          asset_url: string | null
          cost_tokens: number
          created_at: string
          css_class: string | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          preview_url: string | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          asset_url?: string | null
          cost_tokens: number
          created_at?: string
          css_class?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          preview_url?: string | null
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          asset_url?: string | null
          cost_tokens?: number
          created_at?: string
          css_class?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          preview_url?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
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
      token_transactions: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          id: string
          joined_at: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournament_payout"
            referencedColumns: ["tournament_id"]
          },
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          entry_fee: number
          format: string | null
          game: string
          id: string
          max_entries: number | null
          name: string
          rake_pct: number
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          entry_fee?: number
          format?: string | null
          game: string
          id?: string
          max_entries?: number | null
          name: string
          rake_pct?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          entry_fee?: number
          format?: string | null
          game?: string
          id?: string
          max_entries?: number | null
          name?: string
          rake_pct?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_key: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_key: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          equipped: boolean
          id: string
          item_id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          equipped?: boolean
          id?: string
          item_id: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          equipped?: boolean
          id?: string
          item_id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          context: Json | null
          created_at: string
          details: string | null
          id: string
          proof_url: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          context?: Json | null
          created_at?: string
          details?: string | null
          id?: string
          proof_url?: string | null
          reason: string
          reporter_id: string
          resolved_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          context?: Json | null
          created_at?: string
          details?: string | null
          id?: string
          proof_url?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      wallets: {
        Row: {
          balance_points: number
          created_at: string
          lifetime_lost: number
          lifetime_won: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_points?: number
          created_at?: string
          lifetime_lost?: number
          lifetime_won?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_points?: number
          created_at?: string
          lifetime_lost?: number
          lifetime_won?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          provider: string
          signature: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          processed?: boolean
          provider: string
          signature?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
          signature?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      tournament_payout: {
        Row: {
          entries: number | null
          entry_fee: number | null
          gross: number | null
          net_payout: number | null
          rake_pct: number | null
          tournament_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      boost_lfg: { Args: { _cost: number; _hours: number }; Returns: string }
      check_rate_limit: {
        Args: { _action: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      clan_role_of: {
        Args: { _clan: string; _user: string }
        Returns: Database["public"]["Enums"]["clan_role"]
      }
      club_role_of: {
        Args: { _club: string; _user: string }
        Returns: Database["public"]["Enums"]["club_role"]
      }
      equip_cosmetic: {
        Args: { _equip: boolean; _item_id: string }
        Returns: boolean
      }
      has_active_pro_subscription: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clan_member: {
        Args: { _clan: string; _user: string }
        Returns: boolean
      }
      is_club_member: {
        Args: { _club: string; _user: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      media_upload_cost: { Args: { _user: string }; Returns: number }
      media_uploads_today: { Args: { _user: string }; Returns: number }
      process_payment_grant: {
        Args: {
          p_amount_paid: number
          p_currency: string
          p_environment: string
          p_kind: string
          p_metadata: Json
          p_price_id: string
          p_stripe_session_id: string
          p_tokens_granted: number
          p_user_id: string
        }
        Returns: boolean
      }
      purchase_shop_item: { Args: { _item_id: string }; Returns: Json }
      record_daily_login: {
        Args: never
        Returns: {
          reward: number
          streak: number
        }[]
      }
      spend_tokens: { Args: { _amount: number }; Returns: number }
      unlock_cosmetic: {
        Args: { _cost: number; _key: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_kind:
        | "post"
        | "like"
        | "friend_add"
        | "crew_join"
        | "tournament_win"
        | "badge_earned"
        | "streak"
      app_role: "admin" | "moderator" | "user"
      challenge_status:
        | "pending"
        | "accepted"
        | "live"
        | "disputed"
        | "settled"
        | "cancelled"
      clan_role: "leader" | "officer" | "member"
      club_role: "owner" | "officer" | "member" | "recruit"
      escrow_status: "held" | "released" | "refunded"
      play_session_kind: "call" | "lfg_match" | "crew_event"
      report_status: "open" | "reviewing" | "upheld" | "dismissed"
      report_target:
        | "profile"
        | "media_post"
        | "direct_message"
        | "crew"
        | "comment"
      rsvp_status: "yes" | "maybe" | "no"
      tournament_status: "draft" | "open" | "live" | "completed" | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      activity_kind: [
        "post",
        "like",
        "friend_add",
        "crew_join",
        "tournament_win",
        "badge_earned",
        "streak",
      ],
      app_role: ["admin", "moderator", "user"],
      challenge_status: [
        "pending",
        "accepted",
        "live",
        "disputed",
        "settled",
        "cancelled",
      ],
      clan_role: ["leader", "officer", "member"],
      club_role: ["owner", "officer", "member", "recruit"],
      escrow_status: ["held", "released", "refunded"],
      play_session_kind: ["call", "lfg_match", "crew_event"],
      report_status: ["open", "reviewing", "upheld", "dismissed"],
      report_target: [
        "profile",
        "media_post",
        "direct_message",
        "crew",
        "comment",
      ],
      rsvp_status: ["yes", "maybe", "no"],
      tournament_status: ["draft", "open", "live", "completed", "cancelled"],
    },
  },
} as const
