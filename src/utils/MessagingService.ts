import axios from 'axios';

export default class MessagingService {
    public UNIVERSE_ID = '703358927';

    public API_BASE = 'https://apis.roblox.com/messaging-service/v1/';

    public request = axios.create({ baseURL: this.API_BASE, headers: { 'x-api-key': process.env.OPENCLOUD_API_KEY } });

    public async publish(topic: string, data: any) {
        const res = await this.request.post(`/universes/${this.UNIVERSE_ID}/topics/${topic}`, {
            message: JSON.stringify(data),
        }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (res.status !== 200) return null;

        return true;
    }
}