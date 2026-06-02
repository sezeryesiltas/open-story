# Cloud Run + Cloud SQL MySQL

OpenStory API can use Google Cloud SQL for MySQL as its production relational database.
Admin Web does not connect to MySQL directly; it continues to proxy through the API.

## Runtime env

For the Cloud Run API service, set:

```env
NODE_ENV=production
OPEN_STORY_DB_PROVIDER=mysql
OPEN_STORY_MYSQL_INSTANCE_CONNECTION_NAME=<project-id>:<region>:<instance-name>
OPEN_STORY_MYSQL_IP_TYPE=PUBLIC
OPEN_STORY_MYSQL_PORT=3306
OPEN_STORY_MYSQL_DATABASE=open_story
OPEN_STORY_MYSQL_USERNAME=<mysql-username>
OPEN_STORY_MYSQL_PASSWORD=<mysql-password>
OPEN_STORY_DB_READ_CACHE_TTL_MS=60000
```

The API uses the Cloud SQL Node.js Connector with Application Default Credentials. Enable the
Cloud SQL Admin API and grant the Cloud Run API service account the `Cloud SQL Client`
(`roles/cloudsql.client`) role.

For a public IP instance, `OPEN_STORY_MYSQL_IP_TYPE=PUBLIC` is sufficient. The connector provides
encrypted, IAM-authorized connections without manual SSL certificate management.

## Private IP

For a private IP instance, use:

```env
OPEN_STORY_MYSQL_IP_TYPE=PRIVATE
```

The Cloud SQL Node.js Connector does not create a network path. Configure Direct VPC egress or a
Serverless VPC Access connector so the Cloud Run service can reach the instance private IP.

## Direct TCP alternative

For a separately configured direct TCP route, omit `OPEN_STORY_MYSQL_INSTANCE_CONNECTION_NAME` and set:

```env
OPEN_STORY_MYSQL_HOST=<mysql-host>
OPEN_STORY_MYSQL_PORT=3306
OPEN_STORY_MYSQL_SSL_MODE=require
```

## Unix socket compatibility

Unix socket connections remain available with:

```env
OPEN_STORY_MYSQL_SOCKET_PATH=/cloudsql/<project-id>:<region>:<instance-name>
OPEN_STORY_MYSQL_SSL_MODE=disable
```

Attach the matching Cloud SQL instance to the Cloud Run service with `--add-cloudsql-instances`
when using this mode. Cloud SQL Auth Proxy Unix socket connections are not supported for MySQL
8.4 instances. If a configured socket rejects a connection, OpenStory retries with the Node.js
Connector by inferring the instance connection name from the socket path.

At least one of `OPEN_STORY_MYSQL_INSTANCE_CONNECTION_NAME`, `OPEN_STORY_MYSQL_HOST`, or
`OPEN_STORY_MYSQL_SOCKET_PATH` is required.

## Migrated database

The MySQL store uses the normalized OpenStory tables: `client`, `static_token`, `placement`,
`story_group_set`, revision tables, and composition tables. Existing migrated tables must retain
those names. New MySQL databases are initialized with the same logical model automatically.

`story_group_set_revision.target_platforms` and `target_segments` are written as JSON arrays.
The reader also accepts PostgreSQL array literal text in already migrated rows.

## Admin verification

Open Admin Console and navigate to `Settings > DB Settings`. The `MySQL Connection Details`
section shows the effective env-backed values without exposing the password. Use
`Test MySQL connection` to verify Cloud Run API access to the attached Cloud SQL instance.
