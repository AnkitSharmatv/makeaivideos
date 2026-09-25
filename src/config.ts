export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MakeAiVideos";

/** History records kept in IndexedDB. Favorites never count against this. */
export const HISTORY_CAP = 200;

/** Max jobs per Generate press. */
export const BATCH_MAX = 4;
