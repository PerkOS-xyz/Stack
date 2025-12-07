export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      perkos_transactions: {
        Row: {
          id: string
          hash: string
          network: string
          chain_id: number
          scheme: 'exact' | 'deferred'
          payer: string
          payee: string
          amount: string
          asset: string
          status: 'pending' | 'verified' | 'settled' | 'failed'
          error_message: string | null
          block_number: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hash: string
          network: string
          chain_id: number
          scheme: 'exact' | 'deferred'
          payer: string
          payee: string
          amount: string
          asset: string
          status?: 'pending' | 'verified' | 'settled' | 'failed'
          error_message?: string | null
          block_number?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hash?: string
          network?: string
          chain_id?: number
          scheme?: 'exact' | 'deferred'
          payer?: string
          payee?: string
          amount?: string
          asset?: string
          status?: 'pending' | 'verified' | 'settled' | 'failed'
          error_message?: string | null
          block_number?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      perkos_vouchers: {
        Row: {
          id: string
          voucher_id: string
          buyer: string
          seller: string
          value_aggregate: string
          asset: string
          timestamp: string
          nonce: string
          escrow: string
          chain_id: string
          signature: string
          settled: boolean
          settled_tx_hash: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          voucher_id: string
          buyer: string
          seller: string
          value_aggregate: string
          asset: string
          timestamp: string
          nonce: string
          escrow: string
          chain_id: string
          signature: string
          settled?: boolean
          settled_tx_hash?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          voucher_id?: string
          buyer?: string
          seller?: string
          value_aggregate?: string
          asset?: string
          timestamp?: string
          nonce?: string
          escrow?: string
          chain_id?: string
          signature?: string
          settled?: boolean
          settled_tx_hash?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      perkos_agents: {
        Row: {
          id: string
          address: string
          name: string | null
          description: string | null
          url: string | null
          capabilities: string[]
          total_transactions: number
          successful_transactions: number
          total_volume: string
          average_rating: number
          last_transaction_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          address: string
          name?: string | null
          description?: string | null
          url?: string | null
          capabilities?: string[]
          total_transactions?: number
          successful_transactions?: number
          total_volume?: string
          average_rating?: number
          last_transaction_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          address?: string
          name?: string | null
          description?: string | null
          url?: string | null
          capabilities?: string[]
          total_transactions?: number
          successful_transactions?: number
          total_volume?: string
          average_rating?: number
          last_transaction_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      perkos_reviews: {
        Row: {
          id: string
          agent_id: string
          reviewer_address: string
          rating: number
          comment: string | null
          transaction_hash: string | null
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          reviewer_address: string
          rating: number
          comment?: string | null
          transaction_hash?: string | null
          tags?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          reviewer_address?: string
          rating?: number
          comment?: string | null
          transaction_hash?: string | null
          tags?: string[]
          created_at?: string
        }
      }
      perkos_network_stats: {
        Row: {
          id: string
          network: string
          chain_id: number
          date: string
          total_transactions: number
          total_volume: string
          unique_users: number
          average_tx_value: string
          created_at: string
        }
        Insert: {
          id?: string
          network: string
          chain_id: number
          date: string
          total_transactions?: number
          total_volume?: string
          unique_users?: number
          average_tx_value?: string
          created_at?: string
        }
        Update: {
          id?: string
          network?: string
          chain_id?: number
          date?: string
          total_transactions?: number
          total_volume?: string
          unique_users?: number
          average_tx_value?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
