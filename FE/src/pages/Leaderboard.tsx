import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Medal, Flame } from 'lucide-react';

const Leaderboard = () => {
    const navigate = useNavigate();
    const { isAuthenticated, isAuthLoading, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'month' | 'all-time'>('month');

    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthLoading, isAuthenticated, navigate]);

    const rewardPoints = (() => {
        const u = user as { loyaltyPoints?: unknown } | null;
        return typeof u?.loyaltyPoints === 'number' ? u.loyaltyPoints : 0;
    })();

    const currentUserStats = {
        rank: 0,
        avatar: (() => {
            const u = user as { username?: unknown; name?: unknown; email?: unknown } | null;
            const name = (typeof u?.username === 'string' && u.username.trim())
                ? u.username.trim()
                : (typeof u?.name === 'string' && u.name.trim())
                    ? u.name.trim()
                    : (typeof u?.email === 'string' && u.email.trim())
                        ? u.email.trim()
                        : 'me';
            return (name?.[0] || 'M').toUpperCase();
        })(),
        streak: 0,
        points: rewardPoints
    };

    return (
        <div className="app-container">
            <div className="page-wrapper p-0 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 flex items-center gap-4 bg-background z-10">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold">Leaderboard</h1>
                </div>

                {/* Tabs */}
                <div className="px-4 pb-4 bg-background z-10 sticky top-0">
                    <div className="flex bg-secondary p-1 rounded-full">
                        <button
                            onClick={() => setActiveTab('month')}
                            className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${activeTab === 'month'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            This Month
                        </button>
                        <button
                            onClick={() => setActiveTab('all-time')}
                            className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${activeTab === 'all-time'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            All Time
                        </button>
                    </div>
                </div>

                {/* My Rank (Sticky) */}
                <div className="px-4 pb-2 z-10 bg-background sticky top-[130px]">
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                            <span className="text-xl font-bold text-primary min-w-[1.5rem] text-center">#{currentUserStats.rank}</span>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg ring-2 ring-background">
                                    {currentUserStats.avatar}
                                </div>
                                <div>
                                    <p className="font-bold text-sm">You</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                                        <span>{currentUserStats.streak} day streak</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-lg">{currentUserStats.points.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">points</p>
                        </div>
                    </div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto px-4 pb-24">
                    <div className="p-6 text-center text-sm text-muted-foreground">
                        No leaderboard data yet.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
