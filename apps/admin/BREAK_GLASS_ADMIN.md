# Emergency admin login

The admin app supports an environment-only **break-glass** account for situations where the normal Google/database-backed authentication path is unavailable.

Set these variables in the **admin app runtime environment**. Never commit them to Git:

```env
EMERGENCY_ADMIN_ENABLED=true
EMERGENCY_ADMIN_EMAIL=your-admin-email@example.com
EMERGENCY_ADMIN_PASSWORD=use-a-long-random-unique-password-here
```

Open the normal admin sign-in page and use the **Admin password** form. The account is synthesized from the environment and does not require a database user/password record.

## Break-glass MFA behavior

The emergency account intentionally bypasses the normal admin MFA subsystem because that subsystem stores verification tokens in Prisma and sends email. Requiring it would make the emergency account fail during a database/auth outage.

Normal Google/database users still require the existing MFA flow. Only a JWT created by the environment emergency account can bypass it, and only while `EMERGENCY_ADMIN_ENABLED=true`.

Turning `EMERGENCY_ADMIN_ENABLED=false` immediately blocks existing emergency sessions at middleware, even if their JWT has not expired yet.

## Disable after recovery

After normal authentication is healthy again:

```env
EMERGENCY_ADMIN_ENABLED=false
```

Rotate/remove `EMERGENCY_ADMIN_PASSWORD` after use.

## Security requirements

- Use a unique, random password of at least 32 characters.
- Do not reuse the password anywhere else.
- Never commit the emergency password to Git.
- Keep `NEXTAUTH_SECRET` strong and private.
- Enable the emergency account only when needed.
- If your reverse proxy supports an IP allowlist/VPN for admin, keep that protection enabled.

## Important limitation

Break-glass authentication can let you enter the admin app without the normal authentication database path. It cannot make product/order/user pages work if the application database itself is unavailable, because those pages still need Prisma for their data.
