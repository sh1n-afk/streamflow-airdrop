import { useState, useEffect } from 'react'
import './App.css'
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import { useMemo } from 'react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { StreamflowSolana } from '@streamflow/stream'

// Types for transaction tracking
interface TransactionHistory {
  recipient: string
  amount: number
  timestamp: number
  signature: string
}

// Types for airdrop data structure
interface AirdropDetails {
  id: string
  type: 'vested' | 'instant'
  recipientsClaimed: number
  recipientsTotal: number
  amountClaimed: number
  amountTotal: number
  userAmount: number
}

// Form data structure for airdrop creation
interface AirdropCreationParams {
  tokenAmount: string
  recipientsList: string  // Format: "address,amount\naddress2,amount2"
  isVesting: boolean
  vestingPeriod?: number  // in seconds
  vestingStart?: number   // timestamp in ms
}

// Track loading states for UI feedback
interface LoadingStates {
  balance: boolean
  transaction: boolean
  airdropLookup: boolean
  airdropClaim: boolean
  airdropCreate: boolean
  airdropList: boolean
}

function WalletContent() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [balance, setBalance] = useState<number | null>(null)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState<LoadingStates>({
    balance: false,
    transaction: false,
    airdropLookup: false,
    airdropClaim: false,
    airdropCreate: false,
    airdropList: false
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [transactions, setTransactions] = useState<TransactionHistory[]>([])
  const [airdropId, setAirdropId] = useState('')
  const [airdropDetails, setAirdropDetails] = useState<AirdropDetails | null>(null)

  const [createAirdropForm, setCreateAirdropForm] = useState<AirdropCreationParams>({
    tokenAmount: '',
    recipientsList: '',
    isVesting: false,
    vestingPeriod: 0,
    vestingStart: Date.now()
  })

  const [solPrice, setSolPrice] = useState<number | null>(null)

  const LoadingSpinner = () => (
    <div className="loading-spinner">
      <div className="spinner"></div>
    </div>
  )

  useEffect(() => {
    if (!publicKey || !connection) {
      setBalance(null)
      return
    }

    const getBalance = async () => {
      try {
        const balanceInLamports = await connection.getBalance(
          publicKey,
          { commitment: 'finalized' }
        )
        const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL
        setBalance(balanceInSOL)
      } catch (err) {
        console.error('Error fetching balance:', err)
      }
    }

    getBalance()

    const subscriptionId = connection.onAccountChange(
      publicKey,
      (account) => {
        const newBalance = account.lamports / LAMPORTS_PER_SOL
        setBalance(newBalance)
      },
      'finalized'
    )

    const intervalId = setInterval(getBalance, 30000)

    return () => {
      clearInterval(intervalId)
      connection.removeAccountChangeListener(subscriptionId)
    }
  }, [publicKey, connection])

  // Fetch SOL price from CoinGecko API
  const fetchSolPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      const data = await response.json()
      setSolPrice(data.solana.usd)
    } catch (err) {
      console.error('Error fetching SOL price:', err)
    }
  }

  useEffect(() => {
    fetchSolPrice()
    const intervalId = setInterval(fetchSolPrice, 60000)
    return () => clearInterval(intervalId)
  }, [])

  // Helper to validate Solana addresses
  const isValidAddress = (address: string) => {
    try {
      new PublicKey(address)
      return true
    } catch {
      return false
    }
  }

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecipient(e.target.value)
    setError('')
    if (e.target.value && !isValidAddress(e.target.value)) {
      setError('Invalid Solana address')
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value)
    setError('')
    if (balance && parseFloat(e.target.value) > balance) {
      setError('Amount exceeds balance')
    }
  }

  const handleSend = async () => {
    if (!publicKey || !sendTransaction) return

    try {
      setError('')
      setSuccess('')
      setLoading(prev => ({ ...prev, transaction: true }))

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
      
      // Add to transaction history
      setTransactions(prev => [{
        recipient,
        amount: parseFloat(amount),
        timestamp: Date.now(),
        signature
      }, ...prev].slice(0, 5))
      setRecipient('')
      setAmount('')
      setSuccess('Transaction successful!')
    } catch (err) {
      console.error('Error:', err)
      setError(handleError(err, 'Failed to send transaction'))
    } finally {
      setLoading(prev => ({ ...prev, transaction: false }))
    }
  }

  const handleError = (error: unknown, defaultMessage: string): string => {
    if (error instanceof Error) {
      if (error.message.includes('insufficient balance')) {
        return 'Insufficient balance for this transaction'
      }
      if (error.message.includes('invalid address')) {
        return 'Invalid wallet address provided'
      }
      return error.message
    }
    return defaultMessage
  }

  // Form validation for airdrop creation
  const validateAirdropForm = (form: AirdropCreationParams): string | null => {
    if (!form.tokenAmount || parseFloat(form.tokenAmount) <= 0) {
      return 'Token amount must be greater than 0'
    }

    if (!form.recipientsList.trim()) {
      return 'Recipients list cannot be empty'
    }

    const lines = form.recipientsList.trim().split('\n')
    for (let i = 0; i < lines.length; i++) {
      const [address, amount] = lines[i].split(',')
      if (!address || !amount) {
        return `Invalid format at line ${i + 1}. Expected: address,amount`
      }
      try {
        new PublicKey(address.trim())
      } catch {
        return `Invalid address at line ${i + 1}`
      }
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return `Invalid amount at line ${i + 1}`
      }
    }

    if (form.isVesting) {
      if (!form.vestingPeriod || form.vestingPeriod <= 0) {
        return 'Vesting period must be greater than 0'
      }
      if (!form.vestingStart || form.vestingStart < Date.now()) {
        return 'Vesting start time must be in the future'
      }
    }

    return null
  }

  // Fetch airdrop details from Streamflow API
  const fetchAirdropDetails = async () => {
    if (!airdropId || !publicKey) return
    
    try {
      setLoading(prev => ({ ...prev, airdropLookup: true }))
      setError('')
      
      const airdropResponse = await fetch(`https://api-public.streamflow.finance/v2/airdrop/${airdropId}`)
      if (!airdropResponse.ok) {
        throw new Error(
          airdropResponse.status === 404 
            ? 'Airdrop not found' 
            : `Failed to fetch airdrop details (${airdropResponse.status})`
        )
      }
      
      const airdrop = await airdropResponse.json()
      if (!airdrop.data) {
        throw new Error('Invalid airdrop data received')
      }

      const details: AirdropDetails = {
        id: airdropId,
        type: airdrop.data.isVesting ? 'vested' : 'instant',
        recipientsClaimed: airdrop.data.claimedCount || 0,
        recipientsTotal: airdrop.data.totalRecipients || 0,
        amountClaimed: (airdrop.data.claimedAmount || 0) / LAMPORTS_PER_SOL,
        amountTotal: (airdrop.data.totalAmount || 0) / LAMPORTS_PER_SOL,
        userAmount: (airdrop.data.userAmount || 0) / LAMPORTS_PER_SOL
      }
      
      setAirdropDetails(details)
    } catch (err) {
      console.error('Error:', err)
      setError(handleError(err, 'Failed to fetch airdrop details'))
    } finally {
      setLoading(prev => ({ ...prev, airdropLookup: false }))
    }
  }

  // Process airdrop claim request
  const claimAirdrop = async () => {
    if (!publicKey || !airdropDetails || !sendTransaction) return

    try {
      setLoading(prev => ({ ...prev, airdropClaim: true }))
      setError('')
      setSuccess('')

      const streamflow = new StreamflowSolana({
        connection,
        cluster: 'mainnet-beta'
      })

      // Use claim method from SDK
      const { transaction } = await streamflow.claim({
        airdropId: airdropDetails.id,
        recipient: publicKey.toString()
      })

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')
      
      setSuccess('Airdrop claimed successfully!')
      await fetchAirdropDetails()
    } catch (err) {
      console.error('Error:', err)
      setError(handleError(err, 'Failed to claim airdrop'))
    } finally {
      setLoading(prev => ({ ...prev, airdropClaim: false }))
    }
  }

  // Create new airdrop with given parameters
  const createAirdrop = async () => {
    if (!publicKey || !sendTransaction) return

    const validationError = validateAirdropForm(createAirdropForm)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setLoading(prev => ({ ...prev, airdropCreate: true }))
      setError('')
      setSuccess('')

      const streamflow = new StreamflowSolana({
        connection,
        cluster: 'mainnet-beta'
      })

      const { tx: transaction } = await streamflow.create({
        mint: 'SOL',
        amount: parseFloat(createAirdropForm.tokenAmount),
        recipients: createAirdropForm.recipientsList.split('\n').map(line => {
          const [address, amount] = line.split(',')
          return { address: address.trim(), amount: parseFloat(amount) }
        }),
        isVesting: createAirdropForm.isVesting,
        vestingPeriod: createAirdropForm.vestingPeriod || 0,
        vestingStart: createAirdropForm.vestingStart || Date.now()
      })

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')

      setSuccess('Airdrop created successfully!')
      setCreateAirdropForm({
        tokenAmount: '',
        recipientsList: '',
        isVesting: false,
        vestingPeriod: 0,
        vestingStart: Date.now()
      })
    } catch (err) {
      console.error('Error:', err)
      setError(handleError(err, 'Failed to create airdrop'))
    } finally {
      setLoading(prev => ({ ...prev, airdropCreate: false }))
    }
  }

  return (
    <div className="container">
      <h1>Solana Payment App</h1>
      <div className="wallet-section">
        <WalletMultiButton />
        {publicKey && (
          <div className="balance-display">
            Balance: {typeof balance === 'number' ? 
              new Intl.NumberFormat('en-US', { 
                minimumFractionDigits: 5,
                maximumFractionDigits: 5 
              }).format(balance) : '0.00000'} SOL
            {solPrice && typeof balance === 'number' && (
              <span className="usd-value">
                (${(balance * solPrice).toFixed(2)})
              </span>
            )}
          </div>
        )}
      </div>
      {publicKey && (
        <>
          <div className="payment-section">
            <input
              type="text"
              placeholder="Recipient Address"
              value={recipient}
              onChange={handleRecipientChange}
              disabled={loading.transaction}
              className={error && error.includes('address') ? 'error-input' : ''}
            />
            <input
              type="number"
              placeholder="Amount in SOL"
              value={amount}
              onChange={handleAmountChange}
              disabled={loading.transaction}
              step="0.001"
              min="0"
              className={error && error.includes('balance') ? 'error-input' : ''}
            />
            <button 
              onClick={handleSend}
              disabled={loading.transaction || !recipient || !amount || !!error}
            >
              {loading.transaction ? (
                <>
                  <LoadingSpinner />
                  Processing...
                </>
              ) : (
                'Send SOL'
              )}
            </button>
            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}
          </div>

          {}
          <div className="airdrop-section">
            <h2>Airdrop Lookup</h2>
            <div className="airdrop-lookup">
              <input
                type="text"
                placeholder="Enter Airdrop ID"
                value={airdropId}
                onChange={(e) => setAirdropId(e.target.value)}
                disabled={loading.airdropLookup}
              />
              <button
                onClick={fetchAirdropDetails}
                disabled={loading.airdropLookup || !airdropId}
              >
                {loading.airdropLookup ? (
                  <>
                    <LoadingSpinner />
                    Looking up...
                  </>
                ) : (
                  'Look up'
                )}
              </button>
            </div>

            {airdropDetails && (
              <div className="airdrop-details">
                <h3>Airdrop Details</h3>
                <div className="detail-item">
                  <span>Type:</span>
                  <span>{airdropDetails.type}</span>
                </div>
                <div className="detail-item">
                  <span>Recipients:</span>
                  <span>{airdropDetails.recipientsClaimed} / {airdropDetails.recipientsTotal}</span>
                </div>
                <div className="detail-item">
                  <span>Amount:</span>
                  <span>
                    {airdropDetails.amountClaimed} / {airdropDetails.amountTotal} SOL
                    {solPrice && (
                      <span className="usd-value">
                        (${(airdropDetails.amountClaimed * solPrice).toFixed(2)} / 
                        ${(airdropDetails.amountTotal * solPrice).toFixed(2)})
                      </span>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span>Your Amount:</span>
                  <span>
                    {airdropDetails.userAmount} SOL
                    {solPrice && (
                      <span className="usd-value">
                        (${(airdropDetails.userAmount * solPrice).toFixed(2)})
                      </span>
                    )}
                  </span>
                </div>
                <button
                  onClick={claimAirdrop}
                  disabled={loading.airdropClaim || airdropDetails.userAmount === 0}
                >
                  {loading.airdropClaim ? (
                    <>
                      <LoadingSpinner />
                      Claiming...
                    </>
                  ) : (
                    'Claim Airdrop'
                  )}
                </button>
              </div>
            )}
          </div>

          {}
          <div className="airdrop-creation-section">
            <h2>Create Airdrop</h2>
            <div className="form-group">
              <input
                type="number"
                placeholder="Total Token Amount"
                value={createAirdropForm.tokenAmount}
                onChange={(e) => setCreateAirdropForm(prev => ({
                  ...prev,
                  tokenAmount: e.target.value
                }))}
                disabled={loading.airdropCreate}
              />
              <textarea
                placeholder="Recipients List (Format: address,amount)"
                value={createAirdropForm.recipientsList}
                onChange={(e) => setCreateAirdropForm(prev => ({
                  ...prev,
                  recipientsList: e.target.value
                }))}
                disabled={loading.airdropCreate}
              />
              <div className="vesting-options">
                <label>
                  <input
                    type="checkbox"
                    checked={createAirdropForm.isVesting}
                    onChange={(e) => setCreateAirdropForm(prev => ({
                      ...prev,
                      isVesting: e.target.checked
                    }))}
                    disabled={loading.airdropCreate}
                  />
                  Enable Vesting
                </label>
                {createAirdropForm.isVesting && (
                  <>
                    <input
                      type="number"
                      placeholder="Vesting Period (seconds)"
                      value={createAirdropForm.vestingPeriod}
                      onChange={(e) => setCreateAirdropForm(prev => ({
                        ...prev,
                        vestingPeriod: parseInt(e.target.value)
                      }))}
                      disabled={loading.airdropCreate}
                    />
                    <input
                      type="datetime-local"
                      value={new Date(createAirdropForm.vestingStart || Date.now()).toISOString().slice(0, 16)}
                      onChange={(e) => setCreateAirdropForm(prev => ({
                        ...prev,
                        vestingStart: new Date(e.target.value).getTime()
                      }))}
                      disabled={loading.airdropCreate}
                    />
                  </>
                )}
              </div>
              <button
                onClick={createAirdrop}
                disabled={loading.airdropCreate || !createAirdropForm.tokenAmount || !createAirdropForm.recipientsList}
              >
                {loading.airdropCreate ? (
                  <>
                    <LoadingSpinner />
                    Creating...
                  </>
                ) : (
                  'Create Airdrop'
                )}
              </button>
            </div>
          </div>

          {transactions.length > 0 && (
            <div className="transaction-history">
              <h2>Recent Transactions</h2>
              {transactions.map((tx, index) => (
                <div key={index} className="transaction-item">
                  <div>To: {tx.recipient.slice(0, 4)}...{tx.recipient.slice(-4)}</div>
                  <div>{tx.amount} SOL</div>
                  <div>{new Date(tx.timestamp).toLocaleString()}</div>
                  <a 
                    href={`https://explorer.solana.com/tx/${tx.signature}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function App() {
  // Initialize RPC endpoint with fallback
  const endpoint = useMemo(
    () => {
      const apiKey = import.meta.env.VITE_HELIUS_API_KEY
      if (!apiKey) {
        console.error('API key not found')
        return "https://api.mainnet-beta.solana.com"
      }
      return `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
    },
    []
  )

  // Initialize wallet adapter
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
