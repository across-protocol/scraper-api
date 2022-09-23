export type DiscordMeUser = {
  id: string;
  username: string;
  avatar: string;
  avatar_decoration: string;
  discriminator: string;
  public_flags: number;
  flags: number;
  banner: string;
  banner_color: string;
  accent_color: string;
  locale: string;
  mfa_enabled: boolean;
  premium_type: number;
};

export type DiscordGuildUser = {
  avatar: string;
  communication_disabled_until: string;
  flags: number;
  is_pending: boolean;
  joined_at: string;
  nick: string;
  pending: boolean;
  premium_since: string;
  roles: [string];
  user: {
    id: string;
    username: string;
    avatar: string;
    avatar_decoration: string;
    discriminator: string;
    public_flags: number;
  };
  mute: boolean;
  deaf: boolean;
};
