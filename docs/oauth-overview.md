# OAuth Overview

## What is OAuth?
OAuth (Open Authorization) is an open standard that allows a user to grant a third-party application access to their resources without sharing their credentials. Instead of revealing passwords, the user authorizes the application to use an access token issued by an authorization server.

## Key Roles
- **Resource Owner**: The user who controls data or resources.
- **Client**: The application requesting access to the resource owner's data.
- **Resource Server**: The API that hosts the protected resources.
- **Authorization Server**: The server that authenticates the resource owner and issues access tokens to the client.

## OAuth 2.0 Flow (Authorization Code Grant)
1. **User Authorization**: The client redirects the user to the authorization server with a request for permissions (scopes).
2. **Authorization Grant**: After the user approves, the authorization server redirects the user back with an authorization code.
3. **Token Exchange**: The client exchanges the authorization code for an access token (and optionally a refresh token).
4. **API Requests**: The client includes the access token in requests to the resource server to access protected resources.

## Access and Refresh Tokens
- **Access Token**: Short-lived token used to access protected APIs.
- **Refresh Token**: Longer-lived token that can be used to obtain new access tokens without re-prompting the user.

## Scopes
Scopes limit the permissions granted to the client. The authorization server presents scopes during the authorization step so users understand what the application can do.

## Security Considerations
- Use HTTPS to protect tokens in transit.
- Store refresh tokens securely (server-side storage or encrypted at rest).
- Implement token revocation and rotation policies.
- Validate tokens on the resource server (signature, issuer, audience, expiration).

## Common OAuth Providers
- Google, Microsoft, Facebook, GitHub, GitLab, Slack, and many more.

Understanding OAuth allows you to integrate secure third-party login flows and delegate authorization while keeping user credentials safe.
