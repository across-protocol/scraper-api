import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { Strategy } from "passport-oauth2";
import { HttpService } from "@nestjs/axios";
import { stringify } from "querystring";
import { AppConfig } from "../../../configuration/configuration.service";

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, "discord") {
  constructor(private http: HttpService, private config: AppConfig) {
    super({
      authorizationURL: `https://discordapp.com/api/oauth2/authorize?${stringify({
        client_id: config.values.discord.clientId,
        redirect_uri: config.values.discord.redirectUri,
        response_type: "code",
        scope: "identify",
      })}`,
      tokenURL: "https://discordapp.com/api/oauth2/token",
      clientID: config.values.discord.clientId,
      clientSecret: config.values.discord.clientSecret,
      callbackURL: config.values.discord.redirectUri,
      scope: "identify",
    });
  }

  async validate(accessToken: string): Promise<any> {
    const response = await this.http.axiosRef.get("https://discordapp.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  }
}
