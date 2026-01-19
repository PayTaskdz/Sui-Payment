import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { ConnectButton, useCurrentAccount, useDisconnectWallet, useAccounts } from '@mysten/dapp-kit';
import { useEffect, useState } from 'react';
import { Copy, Check, LogOut, Wallet, ChevronRight } from 'lucide-react';

const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const isSmallScreen = window.innerWidth <= 768;
  return mobileRegex.test(userAgent.toLowerCase()) || isSmallScreen;
};

const isInSlushBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('slush') || userAgent.includes('suiwallet');
};

const Login = () => {
  const navigate = useNavigate();
  const { disconnect } = useWallet();
  const currentAccount = useCurrentAccount();
  const accounts = useAccounts();
  const { mutate: disconnectSuiWallet } = useDisconnectWallet();
  const [hasClickedConnect, setHasClickedConnect] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isInWalletBrowser, setIsInWalletBrowser] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showWalletOptions, setShowWalletOptions] = useState(false);
const { loginWithWallet, isAuthLoading } = useAuth();
  const [, setAuthError] = useState<string | null>(null);

  // Use currentAccount if valid, otherwise fallback to first account if available
  const activeAccount = currentAccount || (accounts.length > 0 ? accounts[0] : null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsInWalletBrowser(isInSlushBrowser());
  }, []);

  useEffect(() => {
    if (!hasClickedConnect) return;
    if (!currentAccount?.address) return;
    setShowWalletOptions(true);
  }, [currentAccount?.address, hasClickedConnect]);



  const handleConnectClick = () => {
    // If already connected, show options instead of auto-navigating
    if (activeAccount) {
      setShowWalletOptions(true);
      return;
    }
    setHasClickedConnect(true);
  };

  const handleAuthLogin = async () => {
    setAuthError(null);
    try {
      const { needsOnboarding } = await loginWithWallet();
      navigate(needsOnboarding ? '/onboarding' : '/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setAuthError(message);
    }
  };

  const handleDisconnect = () => {
    disconnectSuiWallet();
    disconnect();
    setShowWalletOptions(false);
  };

  const copyAppLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const showMobileInstructions = isMobile && !isInWalletBrowser;

  return (
    <div className="app-container">
      <div className="page-wrapper justify-between">
        {/* Top spacer */}
        <div className="pt-16" />

        {/* Center content */}
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl font-extrabold tracking-tight mb-3">HiddenWallet</h1>
          <p className="text-muted-foreground">
            Send money instantly with Sui
          </p>
        </div>

        {/* Bottom section */}
        <div className="space-y-4 animate-slide-up pb-6">
          {/* Priority: Show connected options first, then mobile instructions, then default */}
          {activeAccount ? (
            /* Connected Wallet Options Card */
            <div className="card-modern p-5 space-y-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Connected Wallet</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {activeAccount.address.slice(0, 8)}...{activeAccount.address.slice(-6)}
                  </p>
                </div>
              </div>

              <button
                onClick={handleAuthLogin}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continue to App
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleDisconnect}
                className="w-full py-3 rounded-xl border border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Wallet
              </button>
            </div>
          ) : showMobileInstructions ? (
            /* Mobile: Show instructions when not connected */
            <>
              <div className="card-modern p-5 space-y-4">
                <p className="text-sm font-medium text-center">
                  Open in Slush Wallet to connect
                </p>

                <button
                  onClick={copyAppLink}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy App Link
                    </>
                  )}
                </button>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex gap-3 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <span>Open <strong className="text-foreground">Slush Wallet</strong></span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <span>Go to <strong className="text-foreground">Apps</strong> tab</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                    <span>Paste link & tap <strong className="text-foreground">Connect</strong></span>
                  </div>
                </div>
              </div>

              <div onClick={handleConnectClick}>
                <div className="sui-connect-wrapper">
                  <ConnectButton />
                </div>
              </div>
            </>
          ) : currentAccount && showWalletOptions ? (
            /* Connected Wallet Options Card */
            <div className="card-modern p-5 space-y-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Connected Wallet</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {currentAccount.address.slice(0, 8)}...{currentAccount.address.slice(-6)}
                  </p>
                </div>
              </div>

              <button
                onClick={handleAuthLogin}
                disabled={isAuthLoading}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {isAuthLoading ? 'Signing...' : 'Continue to App'}
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleDisconnect}
                className="w-full py-3 rounded-xl border border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Wallet
              </button>
            </div>
          ) : (
            /* Desktop: Just show ConnectButton */
            <div onClick={handleConnectClick}>
              <div className="sui-connect-wrapper">
                <ConnectButton />
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Powered by <span className="font-medium">Sui</span> & <span className="font-medium">Gaian</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
