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
      clubs: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          member_count: number
          name: string
          owner_id: string
          tag: string | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number
          name: string
          owner_id: string
          tag?: string | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number
          name?: string
          owner_id?: string
          tag?: string | null
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
          display_name: string | null
          gender: string | null
          id: string
          is_public: boolean
          lfg_body: string | null
          lfg_games: string[]
          lfg_title: string | null
          playing_hours: Json
          playstyle_badges: string[]
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
          display_name?: string | null
          gender?: string | null
          id: string
          is_public?: boolean
          lfg_body?: string | null
          lfg_games?: string[]
          lfg_title?: string | null
          playing_hours?: Json
          playstyle_badges?: string[]
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
          display_name?: string | null
          gender?: string | null
          id?: string
          is_public?: boolean
          lfg_body?: string | null
          lfg_games?: string[]
          lfg_title?: string | null
          playing_hours?: Json
          playstyle_badges?: string[]
          timezone?: string | null
          updated_at?: string
          username?: string
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
      clan_role_of: {
        Args: { _clan: string; _user: string }
        Returns: Database["public"]["Enums"]["clan_role"]
      }
      club_role_of: {
        Args: { _club: string; _user: string }
        Returns: Database["public"]["Enums"]["club_role"]
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
      spend_tokens: { Args: { _amount: number }; Returns: number }
    }
    Enums: {
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
      tournament_status: ["draft", "open", "live", "completed", "cancelled"],
    },
  },
} as const
