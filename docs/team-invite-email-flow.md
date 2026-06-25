# Team Invite Email Flow

This module sends email invites to company team members and lets invited new
users create an account before accepting the invite.

## Environment

```env
TEAM_INVITE_EMAIL_ENABLED="true"
TEAM_INVITE_FROM_NAME="TallyKonnect"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="TallyKonnect <your-email@gmail.com>"
```

For Gmail, use an app password instead of the normal Gmail password.

## Flow

```txt
Owner/Admin creates invite
-> Token generated and hashed
-> Invite email sent when enabled
-> User opens link
-> Existing user signs in OR new user signs up
-> User accepts invite
-> CompanyUser created
-> Active workspace selected
```

## Important Behavior

Invited new users should not create a new company during signup. Invite signup
uses:

```txt
/sign-up?redirect_url=/invite/<token>&email=member@example.com
```

After signup and email verification, the user is redirected back to the invite
page.

## Security

```txt
Token is stored as SHA-256 hash
Invite email must match signed-in user email
Invite expires
Suspended workspace blocked by workspace guards
```
