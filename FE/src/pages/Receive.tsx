import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { Copy, Share2, Check, X } from 'lucide-react';

const Receive = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { username: walletUsername, walletAddress, isConnected } = useWallet();

  const username = (() => {
    const u = user as { username?: unknown } | null;
    return typeof u?.username === 'string' ? u.username : walletUsername;
  })();
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);



  if (!isConnected) {
    return (
      <div className="app-container">
        <div className="page-wrapper">
          <div className="card-modern py-8 text-center text-muted-foreground text-sm">Wallet not connected.</div>
        </div>
      </div>
    );
  }

  if (!username) {
    return (
      <div className="app-container">
        <div className="page-wrapper">
          <div className="card-modern py-8 text-center text-muted-foreground text-sm">Loading profile...</div>
        </div>
      </div>
    );
  }

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${username}`);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
  };

  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Receive Money on HiddenWallet',
          text: `Send money to @${username} on HiddenWallet!`,
          url: window.location.href,
        });
      } catch (err) {
        handleCopyUsername();
      }
    } else {
      handleCopyUsername();
    }
  };

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : '';

  return (
    <div className="app-container">
      <div className="page-wrapper">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 animate-fade-in">
          <h1 className="text-xl font-bold">Receive</h1>
          <button onClick={() => navigate('/dashboard')} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex-1 flex flex-col items-center animate-slide-up">
          <div className="card-modern p-6 mb-6">
            {/* QR Placeholder */}
            <div className="w-52 h-52 bg-secondary rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <div className="grid grid-cols-8 gap-0.5 p-3 w-full h-full">
                {Array.from({ length: 64 }).map((_, i) => {
                  const hash = (username.charCodeAt(i % username.length) * (i + 1)) % 3;
                  return (
                    <div
                      key={i}
                      className={`w-full h-full rounded-sm ${hash === 0 ? 'bg-foreground' : 'bg-transparent'}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Username */}
            <p className="text-2xl font-bold text-center">@{username}</p>
            <p className="text-sm text-muted-foreground text-center mt-1">Scan to pay me</p>
          </div>

          {/* Wallet Address */}
          <button
            onClick={handleCopyAddress}
            className="card-modern w-full flex items-center justify-between mb-4"
          >
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Wallet Address</p>
              <p className="font-mono text-sm">{shortAddress}</p>
            </div>
            {copiedAddress ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <button onClick={handleCopyUsername} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              {copiedUsername ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedUsername ? 'Copied' : 'Copy'}
            </button>
            <button onClick={handleShare} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receive;
