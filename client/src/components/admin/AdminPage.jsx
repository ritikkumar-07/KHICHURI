import { Building2 } from 'lucide-react';

export function AdminPage({ user }) {
  return <section className="admin-card"><Building2 size={34} /><span className="section-kicker">VERIFIED HOSPITAL ACCESS</span><h1>Hospital Admin</h1><p>Welcome to Sanjeevani Hospital Portal</p><div><small>Hospital Account</small><b>{user.email}</b></div><p className="disclaimer">This portal does not provide automatic access to patient health records.</p></section>;
}
