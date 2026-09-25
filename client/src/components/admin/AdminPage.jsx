import { Building2, ShieldCheck } from 'lucide-react';

export function AdminPage({ user }) {
  const email = user?.email || 'hospital-admin@sanjeevani.health';
  return (
    <section className="admin-card">
      <Building2 size={34} />
      <span className="section-kicker">VERIFIED HOSPITAL ACCESS</span>
      <h1>Hospital Admin</h1>
      <p>Welcome to Sanjeevani Hospital Portal</p>
      <div>
        <small>Hospital Account</small>
        <b>{email}</b>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#10b981', marginTop: '12px' }}>
        <ShieldCheck size={16} /> Verified Administrator Access Active
      </div>
      <p className="disclaimer">This portal does not provide automatic access to patient health records.</p>
    </section>
  );
}
