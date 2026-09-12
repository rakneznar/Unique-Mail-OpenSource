# Privacy information

Last updated: 12 September 2026

Unique Mail is a local-first desktop mail client. Mail data, contacts, calendar data, settings, logs, drafts, and cached attachments are stored on the user's Windows device. Mail account passwords are stored separately using Electron `safeStorage`, which uses operating-system-provided encryption where available. An optional settings export can contain encrypted credential payloads only when the user explicitly includes them.

## Network connections

- Configured IMAP and SMTP servers receive account credentials and mail data as necessary to fetch, synchronize, and send mail.
- GitHub is contacted to check for application updates and download releases. GitHub receives normal connection metadata such as the IP address and user agent.
- Remote images embedded in email are fetched only after the user permits them or trusts the sender. The image host can receive normal connection metadata and identifiers contained in the image URL.
- Gemini is contacted only when an AI-assisted feature is invoked and an API key is configured. Text submitted to that feature is transferred to Google for processing.
- Bug reports and feature requests are sent through the configured feedback SMTP service. If it is not configured, reports remain in a local feedback outbox.
- Links are opened in the user's default browser; the destination website then applies its own privacy policy.

Unique Mail does not include advertising, external analytics, or behavioral telemetry. Local diagnostic logs are not automatically uploaded.

## Retention and deletion

Local data remains until the user removes it, deletes an account, clears application data, or uninstalls and elects to remove retained data. Copies can remain on configured mail servers according to the provider's settings and retention rules. The standard uninstaller intentionally preserves app data to avoid accidental loss during updates.

For publisher-operated support channels, contact `hello@unique-utilities.com`. Before commercial release, the publisher must add its full legal identity, applicable legal bases, concrete retention periods, recipients, complaint authority, and procedures for data-subject requests.
