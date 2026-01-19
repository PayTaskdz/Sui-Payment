import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { useAuth } from '@/context/AuthContext';
import { Wallet, Building2, Scan, Check, Trash2, Shield, LogOut, Loader2, AlertTriangle, ChevronLeft, Copy } from 'lucide-react';
import QRScanner from '@/components/QRScanner';
import { useDisconnectWallet } from '@mysten/dapp-kit';
import {
  addOffchainBankByQr,
  addOnchainWallet,
  deleteOffchainBank,
  deleteOnchainWallet,
  getData,
  getDefaultPaymentMethod,
  getKycLink,
  getKycStatus,
  listOffchainBanks,
  listOnchainWallets,
  scanQr,
  setDefaultPaymentMethod,
} from '@/services/api';


interface ScannedBankData {
  bankName: string;
  accountNumber: string;
  beneficiaryName: string;
}

type ApiWallet = {
  walletId: string;
  address: string;
  label?: string | null;
};

type ApiBank = {
  bankId: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountName: string;
  label?: string | null;
};

const Settings = () => {
  const navigate = useNavigate();
  const { logout, isAuthenticated, user } = useAuth();
  const apiUsername = (() => {
    const u = user as { username?: unknown } | null;
    return typeof u?.username === 'string' ? u.username : null;
  })();
  const { mutate: disconnectSuiWallet } = useDisconnectWallet();
  const { username, disconnect } = useWallet();

  const [linkedBanks, setLinkedBanks] = useState<ApiBank[]>([]);
  const [linkedWallets, setLinkedWallets] = useState<ApiWallet[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [defaultAccountType, setDefaultAccountType] = useState<'wallet' | 'bank'>('wallet');
  const [kycStatus, setKycStatus] = useState<'unverified' | 'pending' | 'verified'>('unverified');
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string>('');

  const walletAddressForKyc = (() => {
    const u = user as { walletAddress?: unknown; address?: unknown } | null;
    const addr = (typeof u?.walletAddress === 'string' && u.walletAddress.trim())
      ? u.walletAddress.trim()
      : (typeof u?.address === 'string' && u.address.trim())
        ? u.address.trim()
        : null;
    return addr;
  })();

  const [view, setView] = useState<'main' | 'add-wallet' | 'add-bank'>('main');
  const [showScanner, setShowScanner] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [scannedBankQr, setScannedBankQr] = useState<string | null>(null);
  const [scannedBank, setScannedBank] = useState<ScannedBankData | null>(null);
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);

  const refreshSettings = async () => {
    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      const [walletsRes, banksRes, defaultRes] = await Promise.all([
        listOnchainWallets(),
        listOffchainBanks(),
        getDefaultPaymentMethod(),
      ]);

      const walletsData = (walletsRes as { data?: unknown })?.data;
      const walletsList = Array.isArray(walletsData)
        ? walletsData
        : (walletsData && typeof walletsData === 'object' && 'wallets' in (walletsData as Record<string, unknown>) && Array.isArray((walletsData as Record<string, unknown>).wallets))
          ? ((walletsData as Record<string, unknown>).wallets as unknown[])
          : [];

      const banksData = (banksRes as { data?: unknown })?.data;
      const banksList = Array.isArray(banksData)
        ? banksData
        : (banksData && typeof banksData === 'object' && 'banks' in (banksData as Record<string, unknown>) && Array.isArray((banksData as Record<string, unknown>).banks))
          ? ((banksData as Record<string, unknown>).banks as unknown[])
          : [];

      setLinkedWallets(walletsList as ApiWallet[]);
      setLinkedBanks(banksList as ApiBank[]);

      const defaultWalletId = defaultRes.data?.walletId ?? null;
      const defaultWalletType = defaultRes.data?.walletType ?? null;
      if (defaultWalletId && defaultWalletType) {
        setDefaultAccountId(defaultWalletId);
        setDefaultAccountType(defaultWalletType === 'onchain' ? 'wallet' : 'bank');
      } else {
        setDefaultAccountId(null);
        setDefaultAccountType('wallet');
      }

      if (walletAddressForKyc) {
        const kycRes = await getKycStatus(walletAddressForKyc);
        const status = kycRes.data?.status;
        if (status === 'pending' || status === 'verified' || status === 'unverified') {
          setKycStatus(status);
        } else {
          setKycStatus('unverified');
        }
      }
    } catch (e) {
      console.error('Failed to load settings', e);
      setSettingsError('Failed to load settings');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);
  // API parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const handleDisconnect = () => {
    disconnectSuiWallet();
    disconnect();
    logout();
    navigate('/login');
  };

  const handleAddWallet = async () => {
    if (!newWalletName || !newWalletAddress) return;

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await addOnchainWallet({
        address: newWalletAddress,
        chain: 'Sui',
        label: newWalletName,
      });
      await refreshSettings();
      setNewWalletName('');
      setNewWalletAddress('');
      setView('main');
    } catch (e) {
      console.error('Failed to add wallet', e);
      setSettingsError('Failed to add wallet');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleScanBank = async (qrString: string) => {
    setShowScanner(false);
    setIsParsing(true);
    setParseError('');
    setScannedBank(null);
    setScannedBankQr(qrString);

    try {
      const res = await scanQr(qrString);
      const payload = res.data as unknown;

      const bankInfo =
        payload && typeof payload === 'object' && 'bankInfo' in (payload as Record<string, unknown>)
          ? (payload as Record<string, unknown>).bankInfo
          : undefined;

      const bankName =
        bankInfo && typeof bankInfo === 'object' && 'bankName' in (bankInfo as Record<string, unknown>)
          ? (bankInfo as Record<string, unknown>).bankName
          : undefined;
      const accountNumber =
        bankInfo && typeof bankInfo === 'object' && 'accountNumber' in (bankInfo as Record<string, unknown>)
          ? (bankInfo as Record<string, unknown>).accountNumber
          : undefined;
      const beneficiaryName =
        bankInfo && typeof bankInfo === 'object' && 'accountName' in (bankInfo as Record<string, unknown>)
          ? (bankInfo as Record<string, unknown>).accountName
          : undefined;

      if (typeof bankName === 'string' && typeof accountNumber === 'string' && typeof beneficiaryName === 'string') {
        setScannedBank({ bankName, accountNumber, beneficiaryName });
      } else {
        setParseError('Invalid QR Code. Please scan a valid bank QR.');
      }
    } catch (error) {
      console.error('Bank QR parsing error:', error);
      setParseError('Failed to parse QR code');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddBank = async () => {
    if (!scannedBank) return;

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await addOffchainBankByQr({
        qrString: scannedBankQr ?? '',
        label: scannedBank.bankName,
      });
      await refreshSettings();
      setScannedBank(null);
      setParseError('');
      setView('main');
    } catch (e) {
      console.error('Failed to add bank account', e);
      setSettingsError('Failed to add bank account');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const isDefault = (id: string, type: 'wallet' | 'bank') =>
    defaultAccountId === id && defaultAccountType === type;
  const handleRemoveWallet = async (id: string) => {
    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await deleteOnchainWallet(id);
      await refreshSettings();
    } catch (e) {
      console.error('Failed to remove wallet', e);
      setSettingsError('Failed to remove wallet');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSetDefault = async (id: string, type: 'wallet' | 'bank') => {
    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await setDefaultPaymentMethod({
        walletId: id,
        walletType: type === 'wallet' ? 'onchain' : 'offchain',
      });
      await refreshSettings();
    } catch (e) {
      console.error('Failed to set default', e);
      setSettingsError('Failed to set default account');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleRemoveBank = async (id: string) => {
    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      await deleteOffchainBank(id);
      await refreshSettings();
    } catch (e) {
      console.error('Failed to remove bank', e);
      setSettingsError('Failed to remove bank account');
    } finally {
      setIsLoadingSettings(false);
    }
  };
  const handleStartKyc = async () => {
    if (!walletAddressForKyc) {
      setSettingsError('No wallet address found for KYC');
      return;
    }

    setSettingsError('');
    setIsLoadingSettings(true);
    try {
      const res = await getKycLink({ walletAddress: walletAddressForKyc });
      const url = res.data?.kycLink || res.data?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        setKycStatus('pending');
      } else {
        console.error('No KYC URL in response:', res.data);
        setSettingsError('Failed to get KYC link');
      }
    } catch (e) {
      console.error('Failed to start KYC', e);
      setSettingsError('Failed to start KYC');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Handle wallet QR scan - reject bank QRs, only accept wallet addresses
  const handleScanWallet = async (qrString: string) => {
    setShowScanner(false);
    setIsParsing(true);
    setParseError('');

    try {
      const trimmed = qrString.trim();

      // Check if it's a HiddenWallet QR (username)
      if (trimmed.startsWith('@') || trimmed.toLowerCase().startsWith('hiddenwallet:')) {
        setParseError('This is a HiddenWallet username QR. Please scan a wallet address QR.');
        setIsParsing(false);
        return;
      }

      // Check if it's a valid wallet address (0x + 64 hex chars)
      if (trimmed.startsWith('0x') && /^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
        setNewWalletAddress(trimmed);
        setIsParsing(false);
        return;
      }

      // Ask BE to scan (to distinguish Bank QR vs garbage)
      try {
        const res = await scanQr(qrString);
        const payload = res.data as unknown;
        const isBankPayload =
          !!payload &&
          typeof payload === 'object' &&
          'bankName' in (payload as Record<string, unknown>) &&
          'accountNumber' in (payload as Record<string, unknown>) &&
          'beneficiaryName' in (payload as Record<string, unknown>);

        if (isBankPayload) {
          setParseError('This is a Bank QR code. Please scan a wallet address QR instead.');
          setIsParsing(false);
          return;
        }
      } catch {
        // ignore
      }

      // Unknown QR format
      setParseError('Invalid QR. Please scan a valid Sui wallet address (0x...).');
    } catch (error) {
      console.error('Wallet QR parsing error:', error);
      setParseError('Failed to parse QR code. Please enter address manually.');
    } finally {
      setIsParsing(false);
    }
  };

  // Add Wallet View
  if (view === 'add-wallet') {
    return (
      <>
        <QRScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleScanWallet}
          title="Scan Wallet QR"
        />
        <div className="app-container">
          <div className="page-wrapper">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 animate-fade-in">
              <h1 className="text-xl font-bold">Add Wallet</h1>
              <button
                onClick={() => { setView('main'); setParseError(''); setNewWalletAddress(''); setNewWalletName(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex-1 space-y-4 animate-slide-up">
              {/* Scan QR Button */}
              <button
                onClick={() => setShowScanner(true)}
                disabled={isParsing}
                className="w-full py-4 rounded-xl bg-secondary hover:bg-secondary/80 text-center font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    Scan Wallet QR Code
                  </>
                )}
              </button>

              {/* Parse Error */}
              {parseError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-medium text-sm">{parseError}</p>
                </div>
              )}

              {/* Or Divider */}
              <div className="flex items-center gap-3 text-muted-foreground text-sm py-2">
                <div className="flex-1 h-px bg-border" />
                <span>or enter manually</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Input Card */}
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Wallet Name</label>
                  <input
                    type="text"
                    value={newWalletName}
                    onChange={(e) => setNewWalletName(e.target.value)}
                    placeholder="e.g. Trading Wallet"
                    className="input-modern w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Wallet Address</label>
                  <input
                    type="text"
                    value={newWalletAddress}
                    onChange={(e) => { setNewWalletAddress(e.target.value); setParseError(''); }}
                    placeholder="0x..."
                    className="input-modern w-full font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAddWallet}
              disabled={!newWalletName || !newWalletAddress}
              className="btn-primary mt-6"
            >
              Add Wallet
            </button>
          </div>
        </div>
      </>
    );
  }

  // Add Bank View
  if (view === 'add-bank') {
    return (
      <>
        <QRScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleScanBank}
          title="Scan Bank QR"
        />
        <div className="app-container">
          <div className="page-wrapper">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 animate-fade-in">
              <h1 className="text-xl font-bold">Add Bank Account</h1>
              <button
                onClick={() => { setView('main'); setScannedBank(null); setParseError(''); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex-1 space-y-4 animate-slide-up">
              {/* Scan QR Button */}
              <button
                onClick={() => setShowScanner(true)}
                disabled={isParsing}
                className="w-full py-4 rounded-xl bg-secondary hover:bg-secondary/80 text-center font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Parsing QR...
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    Scan Bank QR Code
                  </>
                )}
              </button>

              {/* Parse Error */}
              {parseError && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-medium text-sm">{parseError}</p>
                </div>
              )}

              {/* Scanned Bank Info */}
              {scannedBank && (
                <div className="rounded-xl border border-border overflow-hidden animate-slide-up">
                  {/* Success Header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-success/10">
                    <Check className="w-4 h-4 text-success" />
                    <span className="text-success font-medium text-sm">QR Parsed Successfully</span>
                  </div>

                  {/* Bank Details */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Bank</span>
                      <span className="font-medium">{scannedBank.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Account</span>
                      <span className="font-mono text-sm">{scannedBank.accountNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Name</span>
                      <span className="font-medium">{scannedBank.beneficiaryName}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!scannedBank && !parseError && (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Scan your bank's QR code to link it</p>
                </div>
              )}
            </div>

            <button
              onClick={handleAddBank}
              disabled={!scannedBank}
              className="btn-primary mt-6"
            >
              Link Bank Account
            </button>
          </div>
        </div>
      </>
    );
  }

  // Main Settings View
  return (
    <div className="app-container">
      <div className="page-wrapper">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 animate-fade-in">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        {/* Profile */}
        <div className="pb-6 border-b border-border mb-6 animate-slide-up">
          <p className="label-caps mb-2">Username</p>
          <p className="display-medium">@{apiUsername ?? username ?? ''}</p>
        </div>

        {/* Wallets */}
        <div className="mb-6 animate-slide-up stagger-1">
          <p className="section-title">Sui Wallets</p>
          <div className="rounded-xl border border-border overflow-hidden">
            {(linkedWallets || []).map((wallet) => (
              <div key={wallet.walletId} className="row-item px-4">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5" />
                  <div>
                    <p className="font-medium">{wallet.label || 'Wallet'}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {wallet.address.slice(0, 8)}...{wallet.address.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(wallet.address);
                      setCopiedWalletId(wallet.walletId);
                      setTimeout(() => setCopiedWalletId(null), 2000);
                    }}
                    className="p-2 hover:bg-secondary rounded-full transition-colors"
                    title="Copy Address"
                  >
                    {copiedWalletId === wallet.walletId ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className="h-4 w-px bg-border mx-1" />

                  {isDefault(wallet.walletId, 'wallet') ? (
                    <span className="tag-success">Default</span>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(wallet.walletId, 'wallet')}
                      className="text-xs font-medium text-muted-foreground hover:text-primary px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                  {linkedWallets.length > 1 && (
                    <button
                      onClick={() => handleRemoveWallet(wallet.walletId)}
                      className="p-2 hover:bg-destructive/10 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => setView('add-wallet')}
              className="w-full py-4 text-center font-medium hover:bg-secondary transition-colors flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Add Wallet
            </button>
          </div>
        </div>

        {/* Banks */}
        <div className="mb-6 animate-slide-up stagger-2">
          <p className="section-title">Bank Accounts</p>
          <div className="rounded-xl border border-border overflow-hidden">
            {linkedBanks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No banks linked
              </div>
            ) : (
              (linkedBanks || []).map((bank) => (
                <div key={`${bank.bankId}-${bank.bankBin}-${bank.accountNumber}`} className="row-item px-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{bank.label || bank.bankName}</p>
                      <p className="text-sm text-muted-foreground">
                        ****{bank.accountNumber.slice(-4)} · {bank.accountName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDefault(bank.bankId, 'bank') ? (
                      <span className="tag-success">Default</span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(bank.bankId, 'bank')}
                        className="text-xs font-medium text-muted-foreground hover:text-primary px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveBank(bank.bankId)}
                      className="p-2 hover:bg-destructive/10 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => setView('add-bank')}
              className="w-full py-4 text-center font-medium hover:bg-secondary transition-colors border-t border-border flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              Add Bank Account
            </button>
          </div>
        </div>

        {/* KYC */}
        <div className="mb-6 animate-slide-up stagger-3">
          <p className="section-title">Identity</p>
          <div className="rounded-xl border border-border p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                <div>
                  <p className="font-medium">KYC Verification</p>
                  <p className="text-sm text-muted-foreground">Verify for higher limits</p>
                </div>
              </div>
              <span className="tag">Unverified</span>
            </div>
            <button
              onClick={handleStartKyc}
              disabled={isLoadingSettings || !walletAddressForKyc}
              className="w-full py-3 mt-4 border border-border hover:bg-accent transition-colors"
            >
              Start KYC
            </button>
          </div>
        </div>



        {/* Disconnect */}
        <button
          onClick={handleDisconnect}
          className="w-full py-4 rounded-xl text-destructive text-center font-medium border border-destructive hover:bg-destructive hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Disconnect
        </button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          HiddenWallet v1.0 · Sui Testnet
        </p>
      </div>
    </div>
  );
};

export default Settings;
