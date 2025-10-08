import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Dumbbell } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate('/dashboard');
      } else {
        navigate('/auth');
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card/80 backdrop-blur-sm shadow-glow">
          <Dumbbell className="h-12 w-12 text-primary" />
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-foreground border-t-transparent" />
      </div>
    </div>
  );
};

export default Index;
