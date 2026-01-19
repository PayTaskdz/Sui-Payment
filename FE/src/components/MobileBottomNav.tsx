import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ScanLine, Clock } from 'lucide-react';

const MobileBottomNav = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path: string) => location.pathname === path;

    // Only show on dashboard and history pages
    if (location.pathname !== '/dashboard' && location.pathname !== '/history') {
        return null;
    }

    return (
        <nav className="mobile-bottom-nav">
            {/* Home */}
            <button
                onClick={() => navigate('/dashboard')}
                className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            >
                <Home className="nav-icon" />
                <span className="nav-label">Home</span>
            </button>

            {/* Scan QR - Center */}
            <button
                onClick={() => navigate('/send', { state: { autoScan: true } })}
                className="nav-item-scan"
            >
                <div className="scan-button">
                    <ScanLine className="w-6 h-6" />
                </div>
                <span className="nav-label">Scan</span>
            </button>

            {/* History */}
            <button
                onClick={() => navigate('/history')}
                className={`nav-item ${isActive('/history') ? 'active' : ''}`}
            >
                <Clock className="nav-icon" />
                <span className="nav-label">History</span>
            </button>
        </nav>
    );
};

export default MobileBottomNav;
