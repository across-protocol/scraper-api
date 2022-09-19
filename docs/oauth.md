# OAuth2

## Login with Discord using OAuth2 protocol

### Instructions

1. Initiate the login process by accessing the following URL from the frontend application: 
`https://discord.com/api/oauth2/authorize?client_id=<CLIENT_ID>&redirect_uri=<REDIRECT_URI>&response_type=code&scope=identify`

    The `client_id` and `redirect_uri` parameters are recommended to be provided by env variables.

2. User is prompted to allow accessing the Discord account 

![Discord auth prompt](https://discordjs.guide/assets/authorize-app-page.ac905253.png)

3. Once the authorization process is done, the user is redirected to the URL specified by the `redirect_uri` parameter followed by a `code` query parameter. It is up to the FE application to decide how the redirect mechanism should work. The recommendation is to set a dedicated page for handling the redirect flow (e.g /auth/discord), but it's not mandatory.

4. Make an API request to the Across backend endpoint: `https://<ACROSS_API_BASE_URL>/auth/discord?code=<DISCORD_OAUTH_CODE>`, where `DISCORD_OAUTH_CODE` is filled with the value of the `code` query parameter extracted from the URL mentioned above. The backend's response body will be similar to:

```
{
  token: "...",
  user: {
    id: number,
    uuid: number,
    ...
  }
}
```

All the requests that require authorization will need the JWT token attached to the `Authorization` header field. The value of this field should be `Bearer <token>` value.
