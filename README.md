# Streamflow Airdrop Application

A React-based frontend application for managing Solana airdrops using Streamflow protocol.

## Features

- 💳 Phantom Wallet Integration
  - Connect/disconnect wallet
  - View wallet balance in SOL and USD
  - Real-time balance updates

- 💰 SOL Transfer
  - Send SOL to any Solana address
  - Transaction history with explorer links
  - Input validation and error handling

- 🎁 Airdrop Management
  - Look up airdrop details by ID
  - View type (vested/instant)
  - Check recipients and amounts
  - Claim eligible airdrops

- ⚙️ Airdrop Creation
  - Set total token amount
  - Add multiple recipients
  - Configure vesting options
  - Set vesting period and start time

## Setup

1. Clone the repository:
```bash
git clone https://github.com/sh1n-afk/streamflow-airdrop.git
cd streamflow-airdrop
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
# Add your Helius API key to .env
```

4. Run development server:
```bash
npm run dev
```

## Environment Variables

- `VITE_HELIUS_API_KEY`: Your Helius RPC endpoint API key

## Technologies Used

- React 18 + TypeScript
- Vite
- Solana Web3.js
- @solana/wallet-adapter
- Streamflow SDK
- Phantom Wallet

## Project Structure

```
src/
├── App.tsx           # Main application component
├── App.css           # Application styles
├── types/           # TypeScript type definitions
│   └── streamflow-sdk.d.ts  # SDK type definitions
└── assets/          # Static assets
```

## Notes

- The application uses Helius RPC for reliable Solana network connectivity
- Real-time USD conversion using CoinGecko API
- Dark theme UI with responsive design
- Full error handling and loading states
