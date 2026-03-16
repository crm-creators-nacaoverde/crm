import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Input from '../../components/base/Input';
import Button from '../../components/base/Button';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate('/');
      } else {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (signUpError) throw signUpError;

        if (authData.user) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
              id: authData.user.id,
              email: authData.user.email,
              full_name: fullName,
              role: 'viewer',
              is_active: false,
              permissions: {
                clients: { view: false, edit: false },
                interactions: { view: false, edit: false },
                metrics: { view: false },
                settings: { view: false, edit: false },
                users: { view: false, edit: false }
              }
            });

          if (profileError) {
            console.error('Erro ao criar perfil:', profileError);
            throw new Error('Erro ao criar perfil: ' + profileError.message);
          }

          setSuccess('Conta criada com sucesso! Aguarde a aprovação de um administrador para acessar o sistema.');
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setFullName('');
        }
      }
    } catch (err: any) {
      console.error('Erro completo:', err);
      setError(err.message || 'Erro ao processar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafb] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <img 
              src="https://static.readdy.ai/image/70e45d590e9f98e53f87ef3694a62a6d/0c4980ef84e25e6962183ed0f1e9a202.png" 
              alt="Creator Milionário" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {isLogin ? 'Bem-vindo de volta' : 'Criar sua conta'}
          </h1>
          <p className="text-sm text-gray-400 mt-1.5">
            {isLogin ? 'Entre para acessar o CRM Creators' : 'Preencha os dados para começar'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm">
              <i className="ri-error-warning-line text-lg"></i>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm">
              <i className="ri-checkbox-circle-line text-lg"></i>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome completo</label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Digite seu nome"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Processando...
                </span>
              ) : (
                isLogin ? 'Entrar' : 'Criar conta'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-[#004aad] hover:text-[#003d91] text-sm font-medium cursor-pointer"
            >
              {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-300 mt-6">CRM Creators &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
