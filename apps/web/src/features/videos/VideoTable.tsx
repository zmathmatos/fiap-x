import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { StatusPill } from '../../components/StatusPill';
import { DownloadButton } from './DownloadButton';
import { ProgressBar } from './ProgressBar';
import { Thumbnail } from './Thumbnail';
import { RenameField } from './RenameField';
import { formatBytes, formatCount, formatDuration, formatRelativeTime } from '../../lib/format';
import { rowIn } from '../../lib/motion';
import type { VideoSummary } from '../../lib/types';

const HEAD = 'px-md text-label-caps uppercase text-secondary whitespace-nowrap';
const CELL = 'px-md text-data-table-cell';

function DetailLink({ id }: { id: string }): JSX.Element {
  return (
    <Link
      to={`/videos/${id}`}
      className="inline-flex items-center px-sm py-1 rounded-full text-body-sm text-secondary hover:bg-secondary-container/50 hover:text-on-surface transition-colors"
    >
      Detalhes
    </Link>
  );
}

interface VideoTableProps {
  videos: VideoSummary[];
  onRename: (videoId: string, title: string) => Promise<unknown>;
}

/**
 * Rows are keyed by video id and the list is replaced by the poll every two
 * seconds. React reconciles by that key, so a row that was already on screen is
 * updated rather than remounted — which is what keeps the entrance animation from
 * firing again on every tick. Only genuinely new rows animate in.
 */
export function VideoTable({ videos, onRename }: VideoTableProps): JSX.Element {
  return (
    <>
      {/* Desktop and tablet: the dense table the tool is built around. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-row-height border-b border-secondary-container">
              <th scope="col" className={`${HEAD} w-[68px]`}>
                <span className="sr-only">Frame</span>
              </th>
              <th scope="col" className={HEAD}>
                Vídeo
              </th>
              <th scope="col" className={HEAD}>
                Status
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                Duração
              </th>
              <th scope="col" className={`${HEAD} text-right hidden lg:table-cell`}>
                Frames
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                Zip
              </th>
              <th scope="col" className={`${HEAD} hidden lg:table-cell`}>
                Enviado
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {videos.map((video, index) => (
                <motion.tr
                  key={video.id}
                  layout
                  custom={index}
                  variants={rowIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="h-row-height border-b border-secondary-container hover:bg-surface-container-low transition-colors"
                >
                  <td className={`${CELL} py-1`}>
                    <Link to={`/videos/${video.id}`} tabIndex={-1} aria-hidden="true">
                      <Thumbnail
                        path={video.thumbnailUrl}
                        frameCount={video.frameCount}
                        className="w-14 h-9"
                      />
                    </Link>
                  </td>
                  <td className={`${CELL} max-w-[240px]`}>
                    <div className="flex flex-col min-w-0">
                      <RenameField
                        value={video.displayName}
                        onSave={(title) => onRename(video.id, title)}
                        className="font-medium text-on-surface"
                      />
                      {video.title && (
                        <span
                          className="text-[11px] text-secondary truncate"
                          title={video.originalName}
                        >
                          {video.originalName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${CELL} min-w-[140px]`}>
                    <StatusPill status={video.status} />
                    {video.status === 'PROCESSING' && (
                      <ProgressBar percent={video.progressPercent} className="mt-1.5" />
                    )}
                  </td>
                  <td className={`${CELL} text-right tabular-nums text-secondary`}>
                    {formatDuration(video.durationMs)}
                  </td>
                  <td
                    className={`${CELL} text-right tabular-nums text-secondary hidden lg:table-cell`}
                  >
                    {formatCount(video.frameCount)}
                  </td>
                  <td className={`${CELL} text-right tabular-nums text-secondary`}>
                    {formatBytes(video.sizeBytes)}
                  </td>
                  <td className={`${CELL} text-secondary tabular-nums hidden lg:table-cell`}>
                    {formatRelativeTime(video.createdAt)}
                  </td>
                  <td className={`${CELL} text-right`}>
                    {video.downloadable ? (
                      <DownloadButton videoId={video.id} originalName={video.originalName} />
                    ) : (
                      <DetailLink id={video.id} />
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Phone: the same rows as cards, because seven columns do not fit. */}
      <ul className="md:hidden divide-y divide-secondary-container">
        <AnimatePresence initial={false}>
          {videos.map((video, index) => (
            <motion.li
              key={video.id}
              layout
              custom={index}
              variants={rowIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-md flex flex-col gap-sm"
            >
              <div className="flex items-start gap-sm">
                <Thumbnail
                  path={video.thumbnailUrl}
                  frameCount={video.frameCount}
                  className="w-16 h-10"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-xs">
                  <RenameField
                    value={video.displayName}
                    onSave={(title) => onRename(video.id, title)}
                    className="font-medium text-on-surface"
                  />
                  <StatusPill status={video.status} />
                </div>
              </div>

              {video.status === 'PROCESSING' && <ProgressBar percent={video.progressPercent} />}

              <div className="flex flex-wrap gap-x-md gap-y-xs text-body-sm text-secondary tabular-nums">
                <span>{formatDuration(video.durationMs)}</span>
                <span>{formatCount(video.frameCount)} frames</span>
                <span>{formatBytes(video.sizeBytes)}</span>
                <span>{formatRelativeTime(video.createdAt)}</span>
              </div>

              <div>
                {video.downloadable ? (
                  <DownloadButton videoId={video.id} originalName={video.originalName} />
                ) : (
                  <DetailLink id={video.id} />
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}
