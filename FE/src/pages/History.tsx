import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, Copy, Check } from 'lucide-react';

const History = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading } = useAuth();
    const {
        transactions,
        isLoadingBalance,
        refreshBalance,
    } = useWallet();

    const [copiedDigest, setCopiedDigest] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthLoading, isAuthenticated, navigate]);

    if (isAuthLoading) {
        return (
            <div className="app-container">
                <div className="page-wrapper">
                    <div className="card-modern py-8 text-center text-muted-foreground text-sm">Loading...</div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('vi-VN');
    };

    const copyDigest = async (digest: string) => {
        try {
            await navigator.clipboard.writeText(digest);
            setCopiedDigest(digest);
            setTimeout(() => setCopiedDigest(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="app-container">
            <div className="page-wrapper">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 border border-border rounded-xl hover:bg-secondary transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold">Transaction History</h1>
                    </div>
                    <button
                        onClick={refreshBalance}
                        disabled={isLoadingBalance}
                        className="p-2 border border-border rounded-xl hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Transactions List */}
                <div className="flex-1">
                    {isLoadingBalance && transactions.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            Loading transactions...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            <p className="text-lg mb-2">No transactions yet</p>
                            <p className="text-sm">Your transactions will appear here</p>
                        </div>
                    ) : (
                        <div className="card-modern space-y-1">
                            {transactions.map((tx) => {
                                // Use tx.id as digest (real blockchain txs store hash in id)
                                const txHash = tx.digest || tx.id;
                                const truncatedHash = txHash.length > 12
                                    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
                                    : txHash;

                                return (
                                    <div key={tx.id} className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`icon-circle ${tx.type === 'sent' ? 'bg-secondary' : 'bg-success/10'}`}>
                                                {tx.type === 'sent'
                                                    ? <ArrowUpRight className="w-5 h-5" />
                                                    : <ArrowDownLeft className="w-5 h-5 text-success" />
                                                }
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-medium text-sm">
                                                        {tx.type === 'sent' ? 'Sent' : 'Received'}
                                                    </p>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-muted-foreground">•</span>
                                                        <a
                                                            href={`https://suiscan.xyz/mainnet/tx/${txHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-muted-foreground font-mono hover:text-foreground hover:underline transition-colors"
                                                        >
                                                            {truncatedHash}
                                                        </a>
                                                        <button
                                                            onClick={() => copyDigest(txHash)}
                                                            className="p-0.5 hover:bg-secondary rounded transition-colors"
                                                        >
                                                            {copiedDigest === txHash ? (
                                                                <Check className="w-3 h-3 text-success" />
                                                            ) : (
                                                                <Copy className="w-3 h-3 text-muted-foreground" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {tx.type === 'sent' ? `To ${tx.to}` : `From ${tx.from}`} • {formatTime(tx.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className={`font-semibold flex-shrink-0 ${tx.type === 'sent' ? 'text-foreground' : 'text-success'}`}>
                                            {tx.type === 'sent' ? '−' : '+'}${tx.amount.toFixed(3)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default History;
