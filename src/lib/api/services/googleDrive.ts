import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { GoogleDriveFile, DatabaseInfo, DatabaseCache } from '../api';

export class GoogleDriveService {
  private drive: any;
  private authenticated = false;
  private readonly tempDir = '/tmp/water-level-cache';
  private readonly cacheFile = '/tmp/water-level-cache.json';
  private cache: Map<string, DatabaseCache> = new Map();

  constructor() {
    this.ensureTempDir();
    this.loadCache();
  }

  async authenticate(): Promise<void> {
    if (this.authenticated) return;

    try {
      // Use service account credentials from environment
      const credentials = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
        universe_domain: 'googleapis.com'
      };

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });

      this.drive = google.drive({ version: 'v3', auth });
      this.authenticated = true;
      
      console.log('Google Drive authentication successful');
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
      throw new Error('Failed to authenticate with Google Drive');
    }
  }

  async listDatabases(): Promise<DatabaseInfo[]> {
    await this.authenticate();

    try {
      // Use your existing projects folder ID
      const projectsFolderId = '1JjiXRblLAf6rdhiOzrAaYik8bjNpBc9s';
      
      const response = await this.drive.files.list({
        q: `'${projectsFolderId}' in parents and (mimeType='application/vnd.sqlite3' or mimeType='application/x-sqlite3' or name contains '.db')`,
        fields: 'files(id, name, size, modifiedTime, mimeType)',
        pageSize: 100
      });

      const files = response.data.files || [];
      
      const databases: DatabaseInfo[] = await Promise.all(
        files.map(async (file: GoogleDriveFile) => {
          const wellsCount = await this.getWellsCountFromCache(file.id);
          
          return {
            id: file.id,
            name: file.name,
            size: parseInt(file.size || '0'),
            modified: file.modifiedTime,
            wellsCount,
            mimeType: file.mimeType
          };
        })
      );

      return databases.sort((a, b) => 
        new Date(b.modified).getTime() - new Date(a.modified).getTime()
      );
    } catch (error) {
      console.error('Failed to list databases:', error);
      throw new Error('Failed to retrieve database list');
    }
  }

  async downloadDatabase(fileId: string, fileName: string): Promise<string> {
    await this.authenticate();

    const filePath = path.join(this.tempDir, `${fileId}.db`);
    const cacheEntry = this.cache.get(fileId);

    // Check if we have a cached version
    if (cacheEntry && fs.existsSync(cacheEntry.filePath)) {
      // Verify file hasn't changed on Google Drive
      try {
        const fileInfo = await this.drive.files.get({
          fileId,
          fields: 'modifiedTime, size'
        });

        if (fileInfo.data.modifiedTime === cacheEntry.lastModified) {
          console.log(`Using cached database: ${fileName}`);
          return cacheEntry.filePath;
        }
      } catch (error) {
        console.warn('Failed to check file modification time:', error);
      }
    }

    try {
      console.log(`Downloading database: ${fileName}`);
      
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      const writeStream = fs.createWriteStream(filePath);
      
      await new Promise((resolve, reject) => {
        response.data
          .on('end', resolve)
          .on('error', reject)
          .pipe(writeStream);
      });

      // Get file info for caching
      const fileInfo = await this.drive.files.get({
        fileId,
        fields: 'modifiedTime, size'
      });

      // Update cache
      const cacheInfo: DatabaseCache = {
        filePath,
        fileSize: parseInt(fileInfo.data.size || '0'),
        lastModified: fileInfo.data.modifiedTime,
        downloadedAt: Date.now()
      };

      this.cache.set(fileId, cacheInfo);
      this.saveCache();

      console.log(`Database downloaded successfully: ${fileName}`);
      return filePath;
    } catch (error) {
      console.error(`Failed to download database ${fileName}:`, error);
      
      // Clean up partial file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      throw new Error(`Failed to download database: ${fileName}`);
    }
  }

  private async getWellsCountFromCache(fileId: string): Promise<number | undefined> {
    // This would be populated after the first time a database is processed
    // For now, return undefined and let the SQLite service count wells
    return undefined;
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        this.cache = new Map(Object.entries(cacheData));
      }
    } catch (error) {
      console.warn('Failed to load cache:', error);
      this.cache = new Map();
    }
  }

  private saveCache(): void {
    try {
      const cacheData = Object.fromEntries(this.cache.entries());
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  // Clean up old cached files (older than 24 hours)
  cleanupCache(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [fileId, cacheEntry] of this.cache.entries()) {
      if (now - cacheEntry.downloadedAt > maxAge) {
        try {
          if (fs.existsSync(cacheEntry.filePath)) {
            fs.unlinkSync(cacheEntry.filePath);
          }
          this.cache.delete(fileId);
        } catch (error) {
          console.warn(`Failed to clean up cached file: ${cacheEntry.filePath}`, error);
        }
      }
    }

    this.saveCache();
  }
}