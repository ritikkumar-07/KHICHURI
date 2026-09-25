import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function BackButton({ onBack }) {
  const navigate = useNavigate();
  const handleClick = onBack || (() => navigate(-1));
  return <button className="app-back-button" onClick={handleClick}><ArrowLeft size={16} />Back</button>;
}

