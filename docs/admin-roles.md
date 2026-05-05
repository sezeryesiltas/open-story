# Admin Roles

Open Story Admin Console supports three admin roles.

## Super Admin

Super Admin keeps the existing full console permissions:

- Dashboard
- all Content pages
- Client & Tokens
- Users
- DB Settings
- Storage & CDN
- Change Password

Only Super Admin users can create admin users, change another admin user's role, reset admin passwords, manage admin API keys, manage client/static tokens, and update settings. A Super Admin cannot change their own role.

## Story Admin

Story Admin can use:

- Dashboard
- Content: Placements
- Content: Story Bars
- Content: Story Groups
- Content: Stories
- Content: Assets
- Content: Preview

Story Admin cannot see or use Settings, Users, Client & Tokens, DB Settings, Storage & CDN, or admin API key management.

## Story Editor

Story Editor can use:

- Dashboard
- Content: Stories
- Content: Assets
- Content: Preview

Story Editor cannot see Placements, Story Bars, Story Groups, Settings, Users, Client & Tokens, DB Settings, Storage & CDN, or admin API key management.

The Stories workspace may still read supporting content metadata and update story membership so story editing remains usable without exposing those pages in the navigation.
