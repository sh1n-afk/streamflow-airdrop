import { useState, useEffect } from 'react'
import './App.css'
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { clusterApiUrl, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { useMemo } from 'react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { StreamflowSolana } from '@streamflow/stream'

function WalletContent() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [balance, setBalance] = useState<number | null>(null)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!publicKey) {
      setBalance(null)
      return
    }

    const getBalance = async () => {
      const balance = await connection.getBalance(publicKey)
      setBalance(balance / LAMPORTS_PER_SOL)
    }

    getBalance()
    const intervalId = setInterval(getBalance, 1000)
    return () => clearInterval(intervalId)
  }, [publicKey, connection])

  const handleSend = async () => {
    if (!publicKey || !sendTransaction) return

    try {
      setError('')
      setLoading(true)

      const recipientPubKey = new PublicKey(recipient)
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubKey,
          lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
        })
      )

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')
      
      setRecipient('')
      setAmount('')
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send transaction')
    } finally {
      setLoading(false)
    }
  }

  const requestAirdrop = async () => {
    if (!publicKey) return

    try {
      setLoading(true)
      setError('')
      
      const signature = await connection.requestAirdrop(
        publicKey,
        LAMPORTS_PER_SOL
      )

      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: signature
      })
      
    } catch (err) {
      console.error('Error:', err)
      setError('Failed to request airdrop. Try again in a few minutes.')
    } finally {
      setLoading(false)
    }
  }

  const createStream = async () => {
    if (!publicKey || !sendTransaction) return

    try {
      setError('')
      setLoading(true)

      const streamflow = new StreamflowSolana({
        connection,
        cluster: 'devnet'
      })

      const recipientPubKey = new PublicKey(recipient)
      const stream = await streamflow.create({
        recipient: recipientPubKey.toString(),
        mint: 'SOL',
        amount: parseFloat(amount),
        period: 1, // 1 second periods
        cliff: 0,
        canTopup: false,
        cancelableBySender: true,
        cancelableByRecipient: false,
        transferableBySender: true,
        transferableByRecipient: false,
        automaticWithdrawal: true,
        withdrawalFrequency: 1,
      })

      setRecipient('')
      setAmount('')
      console.log('Stream created:', stream)
      
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create stream')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Solana Airdrop App</h1>
      <div className="wallet-section">
        <WalletMultiButton />
        {publicKey && balance !== null && (
          <p className="balance">Balance: {balance.toFixed(4)} SOL</p>
        )}
        {publicKey && (
          <button 
            onClick={requestAirdrop} 
            disabled={loading}
            className="airdrop-button"
          >
            Request 1 SOL from Faucet
          </button>
        )}
      </div>
      {publicKey && (
        <div className="airdrop-section">
          <input
            type="text"
            placeholder="Recipient Address"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={loading}
          />
          <input
            type="number"
            placeholder="Amount in SOL"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            step="0.01"
            min="0"
          />
          <div className="button-group">
            <button 
              onClick={handleSend}
              disabled={loading || !recipient || !amount}
            >
              {loading ? 'Processing...' : 'Send Instant'}
            </button>
            <button 
              onClick={createStream}
              disabled={loading || !recipient || !amount}
            >
              {loading ? 'Processing...' : 'Create Stream'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  )
}

function App() {
  const network = WalletAdapterNetwork.Devnet
  const endpoint = useMemo(() => clusterApiUrl(network), [network])
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default App
