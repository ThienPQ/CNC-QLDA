import { useRouter } from 'next/router';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (username === 'banqlda' && password === 'banqlda123') {
      router.push('/banqlda');
    } else if (username === 'lanhdaoban' && password === 'lanhdaoban123') {
      router.push('/lanhdaoban');
    } else {
      setError('Sai tài khoản hoặc mật khẩu');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-[320px] text-center">
        <img
          src="/logo hhtip.png"
          alt="HHTIP"
          className="mx-auto mb-3 h-16"
        />
        <h2 className="text-base font-semibold mb-4 text-gray-800">
          Hệ thống báo cáo và theo dõi tiến độ + giải ngân dự án
        </h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Tài khoản"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}
