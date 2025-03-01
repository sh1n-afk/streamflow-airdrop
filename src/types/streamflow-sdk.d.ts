declare module '@streamflow/stream' {
  import { Connection, Transaction } from '@solana/web3.js'

  interface StreamflowConfig {
    connection: Connection
    cluster: 'mainnet-beta' | 'devnet' | 'testnet'
  }

  interface ClaimParams {
    airdropId: string
    recipient: string
  }

  interface CreateParams {
    mint: 'SOL' | string
    amount: number
    recipients: Array<{
      address: string
      amount: number
    }>
    isVesting: boolean
    vestingPeriod?: number
    vestingStart?: number
  }

  interface StreamResponse {
    tx: Transaction
    transaction: Transaction
  }

  export class StreamflowSolana {
    constructor(config: StreamflowConfig)
    claim(params: ClaimParams): Promise<StreamResponse>
    create(params: CreateParams): Promise<StreamResponse>
  }
} 