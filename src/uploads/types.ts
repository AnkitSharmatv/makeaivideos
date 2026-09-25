export type RemoteFile = { url: string; expiresAt: number };

export type UploadBackend = (file: Blob, name: string, contentType: string, key: string) => Promise<RemoteFile>;
