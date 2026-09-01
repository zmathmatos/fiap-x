import { Link } from 'react-router-dom';
import { StatusPill } from '../../components/StatusPill';
import { DownloadButton } from './DownloadButton';
import { formatBytes, formatCount, formatDuration, formatRelativeTime } from '../../lib/format';
import type { VideoSummary } from '../../lib/types';

export function VideoTable({ videos }: { videos: VideoSummary[] }): JSX.Element {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Arquivo</th>
            <th scope="col">Status</th>
            <th scope="col" className="table__num">
              Duração
            </th>
            <th scope="col" className="table__num">
              Frames
            </th>
            <th scope="col" className="table__num">
              Zip
            </th>
            <th scope="col">Enviado</th>
            <th scope="col" className="table__actions">
              <span className="visually-hidden">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => (
            <tr key={video.id}>
              <td className="table__name">
                <Link to={`/videos/${video.id}`} title={video.originalName}>
                  {video.originalName}
                </Link>
              </td>
              <td>
                <StatusPill status={video.status} />
              </td>
              <td className="table__num">{formatDuration(video.durationMs)}</td>
              <td className="table__num">{formatCount(video.frameCount)}</td>
              <td className="table__num">{formatBytes(video.sizeBytes)}</td>
              <td className="table__muted">{formatRelativeTime(video.createdAt)}</td>
              <td className="table__actions">
                {video.downloadable ? (
                  <DownloadButton videoId={video.id} originalName={video.originalName} />
                ) : (
                  <Link className="button button--ghost button--sm" to={`/videos/${video.id}`}>
                    Detalhes
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
