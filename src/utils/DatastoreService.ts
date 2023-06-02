import axios from 'axios';
import crypto from 'crypto';

export default class DatastoreService {
    public UNIVERSE_ID = '703358927';

    public API_BASE = 'https://apis.roblox.com/datastores/v1/';

    public request = axios.create({ baseURL: this.API_BASE, headers: { 'x-api-key': process.env.OPENCLOUD_API_KEY } });

    constructor(public datastoreName: string) {}

    public async getEntry<T = any>(key: string): Promise<T | null> {
        const res = await this.request.get<T>(`/universes/${this.UNIVERSE_ID}/standard-datastores/datastore/entries/entry`, {
            params: {
                datastoreName: this.datastoreName,
                entryKey: key,
            }
        }).catch(() => null);

        if (!res) return null;
        if (res.status !== 200) return null;

        return res.data;
    }

    public async createEntry(key: string, data: any) {
        const formattedData = crypto.createHash('md5').update(JSON.stringify(data)).digest('base64');

        const res = await this.request.post(`/universes/${this.UNIVERSE_ID}/standard-datastores/datastore/entries/entry`, data, {
            headers: {
                'content-md5': formattedData,
                'Content-Type': 'application/json',
            },
            params: {
                datastoreName: this.datastoreName,
                entryKey: key,
            }
        }).catch(() => null);

        if (!res) return null;
        if (res.status !== 200) return null;

        return res.data;
    }

    public async deleteEntry(key: string) {
        const res = await this.request.delete(`/universes/${this.UNIVERSE_ID}/standard-datastores/datastore/entries/entry`, {
            params: {
                datastoreName: this.datastoreName,
                entryKey: key,
            }
        }).catch(() => null);

        if (!res) return null;
        if (res.status !== 200) return null;

        return res.data;
    }
}