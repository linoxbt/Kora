import React, { useEffect, useState } from 'react';
import { ArrowRight, Copy, ShieldCheck, UserPlus } from 'lucide-react';
import type { Session } from './session.js';

type Workspace = { merchant_id: string; name: string; role: 'owner' | 'viewer' | 'editor' };
type Member = {
  id: string;
  identity_id: string;
  role: 'owner' | 'viewer' | 'editor';
  revoked_at: string | null;
};
type Invitation = {
  id: string;
  role: 'viewer' | 'editor';
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
};
export function AccountPage({
  session,
  go,
  onSession,
}: {
  session: Session;
  go: (path: string) => void;
  onSession: (session: Session) => void;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [newLink, setNewLink] = useState('');
  const [newInviteId, setNewInviteId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    if (!session.account_saved) return;
    const workspaceResult = await fetch('/console/workspaces', { credentials: 'include' });
    if (workspaceResult.ok) setWorkspaces((await workspaceResult.json()).data);
    if (session.role === 'owner') {
      const teamResult = await fetch('/console/team', { credentials: 'include' });
      if (teamResult.ok) {
        const team = await teamResult.json();
        setMembers(team.members);
        setInvitations(team.invitations);
      }
    }
  }
  useEffect(() => {
    void refresh().catch(() => setError('Unable to load workspace access.'));
  }, [session.merchant_id, session.role]);
  async function post(url: string, body?: object) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-kora-csrf': session.csrf_token ?? '',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? 'Unable to update workspace access.');
      await refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update workspace access.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  const canSave =
    !session.account_saved &&
    ['payments', 'customers', 'webhooks', 'keys', 'operations'].every((group) =>
      ['read', 'write'].every((action) => session.scopes?.includes(`${group}:${action}`)),
    );
  return (
    <div className="account-page">
      <div className="page-heading">
        <div>
          <h1>Account & access</h1>
          <p>How you sign in and return to your workspace.</p>
        </div>
      </div>
      <section className="card account-card">
        <ShieldCheck size={25} />
        <h2>
          {session.account_saved ? 'Your workspace access is saved.' : 'Make this workspace yours.'}
        </h2>
        <p>
          {session.account_saved
            ? 'Sign in with the same Business email on another device to reopen your workspaces.'
            : 'Save this sandbox to a verified email account to return on another device.'}
        </p>
        <dl>
          <div>
            <dt>Sign-in method</dt>
            <dd>
              {session.auth_method === 'email'
                ? 'Microsendr email code'
                : session.auth_method === 'privy'
                  ? 'Legacy email login'
                : session.auth_method === 'sandbox'
                  ? 'Sandbox guest'
                  : 'Workspace session'}
            </dd>
          </div>
          <div>
            <dt>Workspace ID</dt>
            <dd className="mono">{session.merchant_id}</dd>
          </div>
          {session.role && (
            <div>
              <dt>Access</dt>
              <dd>
                {session.role === 'owner'
                  ? 'Owner'
                  : session.role === 'editor'
                    ? 'Payments editor'
                    : 'Viewer'}
              </dd>
            </div>
          )}
          <div>
            <dt>Session</dt>
            <dd>Protected cookie · expires after 24 hours</dd>
          </div>
        </dl>
        {canSave && (
          <button className="button primary" onClick={() => go('/login/save')}>
            Save workspace with email <ArrowRight size={16} />
          </button>
        )}
        {!session.account_saved && !canSave && (
          <p className="muted">
            Your workspace administrator can save this workspace to an email login.
          </p>
        )}
        {session.scopes?.includes('keys:read') && (
          <button className="button subtle" onClick={() => go('/app/developers')}>
            Manage API keys <ArrowRight size={16} />
          </button>
        )}
      </section>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {workspaces.length > 1 && (
        <section className="card account-card">
          <h2>Your workspaces</h2>
          <p>Switching refreshes your session with that workspace’s access.</p>
          {workspaces.map((workspace) => (
            <div key={workspace.merchant_id} className="account-row">
              <span>
                {workspace.name} · {workspace.role}
              </span>
              <button
                className="button subtle"
                disabled={busy || workspace.merchant_id === session.merchant_id}
                onClick={() =>
                  void post('/console/workspaces/switch', {
                    merchant_id: workspace.merchant_id,
                  }).then((result) => {
                    if (result) {
                      onSession(result);
                      go('/app/overview');
                    }
                  })
                }
              >
                {workspace.merchant_id === session.merchant_id ? 'Current' : 'Switch'}
              </button>
            </div>
          ))}
        </section>
      )}
      {session.role === 'owner' && (
        <section className="card account-card">
          <UserPlus size={25} />
          <h2>Team access</h2>
          <p>
            Create a private link for one teammate. Anyone with the link and a verified Microsendr login
            can use it once within seven days.
          </p>
          <label>
            Access level
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as 'viewer' | 'editor')}
            >
              <option value="viewer">Viewer · payments, customers and operations read-only</option>
              <option value="editor">Payments editor · payments and customers read/write</option>
            </select>
          </label>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void post('/console/team/invitations', { role: inviteRole }).then((result) => {
                if (result) {
                  setNewLink(`${window.location.origin}/business/login#invite=${result.token}`);
                  setNewInviteId(result.id);
                }
              })
            }
          >
            Create invitation
          </button>
          {newLink && (
            <div className="account-invite-link">
              <label>
                Private invitation link
                <input readOnly value={newLink} onFocus={(event) => event.target.select()} />
              </label>
              <button
                className="button subtle"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(newLink)
                    .catch(() => setError('Select and copy the invitation link instead.'))
                }
              >
                <Copy size={16} /> Copy link
              </button>
            </div>
          )}
          <h3>Members</h3>
          {members
            .filter((member) => !member.revoked_at)
            .map((member) => (
              <div key={member.id} className="account-row">
                <span>
                  {member.role === 'owner'
                    ? 'Owner'
                    : member.role === 'editor'
                      ? 'Payments editor'
                      : 'Viewer'}{' '}
                  · <span className="mono">{member.identity_id.slice(0, 18)}…</span>
                </span>
                {member.role !== 'owner' && (
                  <button
                    className="button subtle"
                    disabled={busy}
                    onClick={() => void post(`/console/team/members/${member.id}/revoke`)}
                  >
                    Revoke access
                  </button>
                )}
              </div>
            ))}
          <h3>Invitations</h3>
          {invitations.length === 0 && <p className="muted">No invitations yet.</p>}
          {invitations.map((invite) => (
            <div key={invite.id} className="account-row">
              <span>
                {invite.role === 'editor' ? 'Payments editor' : 'Viewer'} ·{' '}
                {invite.revoked_at
                  ? 'Revoked'
                  : invite.claimed_at
                    ? 'Used'
                    : new Date(invite.expires_at) < new Date()
                      ? 'Expired'
                      : 'Pending'}
              </span>
              {!invite.revoked_at &&
                !invite.claimed_at &&
                new Date(invite.expires_at) > new Date() && (
                  <button
                    className="button subtle"
                    disabled={busy}
                    onClick={() =>
                      void post(`/console/team/invitations/${invite.id}/revoke`).then((result) => {
                        if (result && newInviteId === invite.id) {
                          setNewLink('');
                          setNewInviteId('');
                        }
                      })
                    }
                  >
                    Revoke link
                  </button>
                )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
