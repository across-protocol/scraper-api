import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { Strategy } from "passport-oauth2";
import { HttpService } from "@nestjs/axios";
import { stringify } from "querystring";
import { AppConfig } from "../../../configuration/configuration.service";
import { DiscordApiService } from "../../adapters/discord";

const ACROSS_DISCORD_GUILD_ID = "887426921892315137";

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, "discord") {
  constructor(private http: HttpService, private config: AppConfig, private discordApi: DiscordApiService) {
    super({
      authorizationURL: `https://discordapp.com/api/oauth2/authorize?${stringify({
        client_id: config.values.discord.clientId,
        redirect_uri: config.values.discord.redirectUri,
        response_type: "code",
      })}`,
      tokenURL: "https://discordapp.com/api/oauth2/token",
      clientID: config.values.discord.clientId,
      clientSecret: config.values.discord.clientSecret,
      callbackURL: config.values.discord.redirectUri,
    });
  }

  async validate(accessToken: string): Promise<any> {
    let result = {};
    const user = await this.discordApi.getUserMe(accessToken);

    result = {
      id: user.id,
      name: user.username || undefined,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.jpeg` : undefined,
    };

    const guildUser = await this.discordApi.getGuildUser(accessToken, ACROSS_DISCORD_GUILD_ID);

    if (guildUser?.nick) {
      result = { ...result, name: guildUser.nick };
    }

    if (guildUser?.avatar) {
      result = {
        ...result,
        avatar: `https://cdn.discordapp.com/guilds/${ACROSS_DISCORD_GUILD_ID}/users/${user.id}/avatars/${guildUser.avatar}.jpeg`,
      };
    }

    return result;
  }
}
