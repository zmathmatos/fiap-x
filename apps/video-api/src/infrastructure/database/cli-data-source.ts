import { loadConfig } from '../../config';
import { createDataSource } from './data-source';

/**
 * Entry point for the TypeORM CLI (`npm run migration:run`).
 *
 * Kept apart from `data-source.ts` on purpose: importing this module reads and
 * validates the environment, which is right for the CLI and wrong for tests that
 * build their own DataSource against a throwaway container.
 */
export default createDataSource(loadConfig().database);
