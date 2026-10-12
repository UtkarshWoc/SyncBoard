import type { InvitePreview } from '@syncboard/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar, FullPageMessage, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';

export default function InvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .previewInvite(token)
      .then(setPreview)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      const { boardId } = await api.acceptInvite(token);
      navigate(`/board/${boardId}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (error) {
    return (
      <FullPageMessage title="Invite unavailable">
        <p className="muted">{error}</p>
        <Link to="/" className="btn btn-ghost">
          Go to my boards
        </Link>
      </FullPageMessage>
    );
  }
  if (!preview) return <Spinner label="Opening invite…" />;

  return (
    <FullPageMessage title={`Join “${preview.boardName}”`}>
      {preview.owner && (
        <p className="row gap center muted">
          <Avatar user={preview.owner} size={24} /> {preview.owner.displayName} invited you as{' '}
          {preview.role === 'editor' ? 'an editor' : 'a viewer'}.
        </p>
      )}
      <button className="btn btn-primary btn-block" onClick={accept} disabled={busy}>
        {busy ? 'Joining…' : 'Accept and open board'}
      </button>
    </FullPageMessage>
  );
}
