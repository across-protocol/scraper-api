import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { DiscordMeUser, DiscordGuildUser } from "./model";

@Injectable()
export class DiscordApiService {
  constructor(private http: HttpService) {}

  public async getUserMe(accessToken: string): Promise<DiscordMeUser> {
    const response = await this.http.axiosRef.get("https://discordapp.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return response.data;
  }

  public async getGuildUser(accessToken: string, guildId: string): Promise<DiscordGuildUser> {
    try {
      const response = await this.http.axiosRef.get(`https://discordapp.com/api/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) return undefined;
      throw error;
    }
  }
}
