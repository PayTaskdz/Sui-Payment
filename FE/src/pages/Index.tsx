import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';

const Index = () => {
  const navigate = useNavigate();
  const { isConnected, username } = useWallet();

  useEffect(() => {
    if (isConnected && username) {
      navigate('/dashboard');
    } else if (isConnected) {
      navigate('/onboarding');
    } else {
      navigate('/login');
    }
  }, [isConnected, username, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-4">Welcome to HiddenWallet</h1>
      {/* Index page implementation */}
    </div>
  );
};

export default Index;
