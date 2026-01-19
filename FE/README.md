# HiddenWallet UI- Sui Blockchain Wallet

A minimalist Sui Blockchain Wallet WebApp for the Sui Hackathon.

## Features

- **Connect Wallet**: Connect using Sui wallets (Slush, Sui Wallet, Suiet, etc.)
- **Username System**: Claim a unique @username for easy payments
- **Send SUI**: Send to HiddenWallet usernames or scan VietQR codes
- **QR Scanner**: Camera-based QR scanning for payments
- **Bank Linking**: Link bank accounts via QR code

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS + Shadcn/UI
- **Blockchain**: Sui Network via @mysten/dapp-kit

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── context/        # React context providers
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── providers/      # Sui wallet providers
└── lib/            # Utility functions
```

## License

MIT
