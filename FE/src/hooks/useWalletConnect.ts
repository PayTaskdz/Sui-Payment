import SignClient from '@walletconnect/sign-client';
import { useState, useEffect, useCallback } from 'react';

// WalletConnect Project ID - Get from https://cloud.walletconnect.com
// Using a public demo project ID for testing - should be replaced with your own
const PROJECT_ID = 'e5f0f4c4f3c7f8b0a5d7c9a1b2e3f4d5';

const SUI_CHAIN = 'sui:mainnet';

export interface WalletConnectState {
    uri: string | null;
    isConnecting: boolean;
    isConnected: boolean;
    address: string | null;
    error: string | null;
}

export function useWalletConnect() {
    const [client, setClient] = useState<SignClient | null>(null);
    const [state, setState] = useState<WalletConnectState>({
        uri: null,
        isConnecting: false,
        isConnected: false,
        address: null,
        error: null,
    });

    // Initialize WalletConnect client
    useEffect(() => {
        const initClient = async () => {
            try {
                const signClient = await SignClient.init({
                    projectId: PROJECT_ID,
                    metadata: {
                        name: 'HiddenWallet',
                        description: 'HiddenWallet for Sui Blockchain',
                        url: 'https://hiddenwallet.app',
                        icons: [`${window.location.origin}/favicon.ico`],
                    },
                });

                setClient(signClient);

                // Handle session events
                signClient.on('session_event', (event) => {

                });

                signClient.on('session_update', ({ topic, params }) => {

                });

                signClient.on('session_delete', () => {
                    setState((prev) => ({
                        ...prev,
                        isConnected: false,
                        address: null,
                    }));
                });
            } catch (error) {
                console.error('Failed to init WalletConnect:', error);
                setState((prev) => ({
                    ...prev,
                    error: 'Failed to initialize WalletConnect',
                }));
            }
        };

        initClient();
    }, []);

    // Connect and generate URI
    const connect = useCallback(async () => {
        if (!client) {
            setState((prev) => ({ ...prev, error: 'Client not initialized' }));
            return null;
        }

        setState((prev) => ({ ...prev, isConnecting: true, error: null }));

        try {
            const { uri, approval } = await client.connect({
                requiredNamespaces: {
                    sui: {
                        methods: [
                            'sui_signTransactionBlock',
                            'sui_signAndExecuteTransactionBlock',
                            'sui_signMessage',
                        ],
                        chains: [SUI_CHAIN],
                        events: [],
                    },
                },
            });

            if (uri) {
                setState((prev) => ({ ...prev, uri }));

                // Wait for wallet approval
                const session = await approval();
                const accounts = session.namespaces.sui?.accounts || [];
                const address = accounts[0]?.split(':')[2] || null;

                setState((prev) => ({
                    ...prev,
                    isConnecting: false,
                    isConnected: true,
                    address,
                    uri: null,
                }));

                return { uri, address };
            }
        } catch (error) {
            console.error('WalletConnect error:', error);
            setState((prev) => ({
                ...prev,
                isConnecting: false,
                error: 'Connection failed or rejected',
            }));
        }

        return null;
    }, [client]);

    // Open Slush Wallet with WC URI
    const openSlushWallet = useCallback(async () => {
        if (!client) {
            // Fallback to simple deeplink if client not ready
            window.location.href = 'suiwallet://';
            return;
        }

        try {
            const { uri } = await client.connect({
                requiredNamespaces: {
                    sui: {
                        methods: [
                            'sui_signTransactionBlock',
                            'sui_signAndExecuteTransactionBlock',
                            'sui_signMessage',
                        ],
                        chains: [SUI_CHAIN],
                        events: [],
                    },
                },
            });

            if (uri) {
                setState((prev) => ({ ...prev, uri, isConnecting: true }));

                // Open Slush Wallet with WC URI
                const encodedUri = encodeURIComponent(uri);
                const deepLink = `suiwallet://wc?uri=${encodedUri}`;
                window.location.href = deepLink;
            }
        } catch (error) {
            console.error('Failed to generate WC URI:', error);
            // Fallback to simple deeplink
            window.location.href = 'suiwallet://';
        }
    }, [client]);

    const disconnect = useCallback(async () => {
        if (!client) return;

        const sessions = client.session.getAll();
        for (const session of sessions) {
            await client.disconnect({
                topic: session.topic,
                reason: { code: 6000, message: 'User disconnected' },
            });
        }

        setState({
            uri: null,
            isConnecting: false,
            isConnected: false,
            address: null,
            error: null,
        });
    }, [client]);

    return {
        ...state,
        connect,
        disconnect,
        openSlushWallet,
        client,
    };
}
