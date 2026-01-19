import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Eye, EyeOff, Copy, Check, Users, TrendingUp, Award, Trophy } from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading, user } = useAuth();

    const {
        usdcBalance,
        suiBalance,
        transactions,
        isConnected,
        isLoadingBalance,
    } = useWallet();
    const rewardPoints = useMemo(() => {
        const u = user as { loyaltyPoints?: unknown } | null;
        return typeof u?.loyaltyPoints === 'number' ? u.loyaltyPoints : 0;
    }, [user]);

    const referralStats = useMemo(() => {
        const u = user as { commissionBalance?: unknown; f0Volume?: unknown; refereesCount?: unknown } | null;

        const totalCommission = typeof u?.commissionBalance === 'number' ? u.commissionBalance : 0;
        const f0Volume = typeof u?.f0Volume === 'number' ? u.f0Volume : 0;
        const f0Count = typeof u?.refereesCount === 'number' ? u.refereesCount : 0;

        return { totalCommission, f0Volume, f0Count };
    }, [user]);

    const username = useMemo(() => {
        const u = user as { username?: unknown } | null;
        return typeof u?.username === 'string' && u.username.length > 0 ? u.username : null;
    }, [user]);

    const [showBalance, setShowBalance] = useState(true);
    const [copiedDigest, setCopiedDigest] = useState<string | null>(null);

    if (isAuthLoading) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg font-semibold">Chưa đăng nhập</div>
                    <button className="btn btn-primary mt-4" onClick={() => navigate('/login')}>
                        Quay lại Login
                    </button>
                </div>
            </div>
        );
    }

    if (!isConnected) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-lg font-semibold">Wallet chưa connect</div>
                    <div className="text-sm opacity-70 mt-1">Bạn cần connect ví Sui để xem Dashboard.</div>
                    <button className="btn btn-primary mt-4" onClick={() => navigate('/login')}>
                        Quay lại Login
                    </button>
                </div>
            </div>
        );
    }

    if (!username) {
        return (
            <div className="app-container flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4" />
                    <div className="text-lg font-semibold">Đang tải hồ sơ</div>
                    <div className="text-sm opacity-70 mt-1">Vui lòng đợi...</div>
                    <button
                        className="btn btn-ghost text-sm mt-4"
                        onClick={() => window.location.reload()}
                    >
                        Tải lại trang
                    </button>
                </div>
            </div>
        );
    }

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Now';
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    const formatVolume = (volume: number) => {
        if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
        if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}k`;
        return `$${volume}`;
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

    // Split balance into whole and decimal
    const balanceWhole = Math.floor(usdcBalance);
    const balanceDecimal = (usdcBalance - balanceWhole).toFixed(2).slice(1); // .00

    const recentTransactions = transactions.slice(0, 3);

    return (
        <div className="app-container">
            <div className="page-wrapper">
                {/* Header - User Pill & Reward Badge */}
                <div className="flex items-center justify-between animate-fade-in pt-2">
                    <button
                        onClick={() => navigate('/settings')}
                        className="user-pill"
                    >
                        <div className="user-avatar">
                            <span className="text-xs font-semibold">{username[0].toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-sm">{username}</span>
                    </button>

                    {/* Reward Points Badge - Subtle */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full transition-colors hover:bg-secondary/80 cursor-default">
                        <span className="text-sm">🏆</span>
                        <span className="text-sm font-medium">{rewardPoints.toLocaleString()} pts</span>
                    </div>
                </div>

                {/* Balance Section */}
                <div className="py-8 text-center animate-slide-up">
                    {/* USDC Balance - Large */}
                    <div className="flex items-baseline justify-center">
                        {showBalance ? (
                            <>
                                <span className="balance-display">
                                    ${isLoadingBalance ? '...' : balanceWhole}
                                </span>
                                <span className="balance-decimal">
                                    {isLoadingBalance ? '' : balanceDecimal}
                                </span>

                            </>
                        ) : (
                            <span className="balance-display">$•••••</span>
                        )}
                        <button
                            onClick={() => setShowBalance(!showBalance)}
                            className="ml-2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* SUI Balance - Small Gray */}
                    <p className="text-sm text-muted-foreground mt-1">
                        {showBalance ? `${suiBalance.toFixed(4)} SUI` : '••• SUI'}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-3 animate-slide-up stagger-1">
                    <button
                        onClick={() => navigate('/send')}
                        className="btn-pill-primary"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Send
                    </button>
                    <button
                        onClick={() => navigate('/receive')}
                        className="btn-pill-secondary"
                    >
                        <ArrowDownLeft className="w-4 h-4" />
                        Receive
                    </button>
                </div>

                {/* Referral Stats Card */}
                <div className="mt-6 animate-slide-up stagger-2">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="section-title mb-0">Affiliate Performance</h3>
                        <button
                            onClick={() => navigate('/leaderboard')}
                            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                        >
                            <Trophy className="w-3.5 h-3.5" />
                            Leaderboard
                        </button>
                    </div>
                    <div className="card-modern">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            {/* Commission */}
                            <div className="py-2">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <Award className="w-4 h-4 text-success" />
                                </div>
                                <p className="text-lg font-bold">${referralStats.totalCommission}</p>
                                <p className="text-xs text-muted-foreground">Earned</p>
                            </div>
                            {/* Volume */}
                            <div className="py-2 border-l border-r border-border relative group cursor-pointer" onClick={() => navigate('/leaderboard')}>
                                <div className="absolute inset-x-2 -top-2 -bottom-2 bg-secondary/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative flex items-center justify-center gap-1.5 mb-1">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="relative">
                                    <p className="text-lg font-bold">{formatVolume(referralStats.f0Volume)}</p>
                                    <p className="text-xs text-muted-foreground">Volume</p>
                                </div>
                            </div>
                            {/* Network */}
                            <div className="py-2">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <Users className="w-4 h-4 text-success" />
                                </div>
                                <p className="text-lg font-bold">{referralStats.f0Count}</p>
                                <p className="text-xs text-muted-foreground">F0 Friends</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 animate-slide-up stagger-3 hidden md:block">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="section-title mb-0">Recent Activity</h3>
                        <button
                            onClick={() => navigate('/history')}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            See all →
                        </button>
                    </div>

                    <div className="card-modern space-y-1">
                        {recentTransactions.length > 0 ? (
                            recentTransactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between py-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`icon-circle ${tx.type === 'sent' ? 'bg-secondary' : 'bg-success/10'}`}>
                                            {tx.type === 'sent'
                                                ? <ArrowUpRight className="w-4 h-4" />
                                                : <ArrowDownLeft className="w-4 h-4 text-success" />
                                            }
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">
                                                {tx.type === 'sent' ? 'Sent' : 'Received'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatTime(tx.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`font-semibold ${tx.type === 'sent' ? '' : 'text-success'}`}>
                                        {tx.type === 'sent' ? '−' : '+'}{tx.amount.toFixed(3)}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                No transactions yet
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
