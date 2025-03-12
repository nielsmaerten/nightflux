# Nightflux

**Nightflux** is a lightweight tool that imports events from **Nightscout** into **InfluxDB**.  
It can be run as a standalone binary or using Docker.

## Supported Events

Nightflux currently supports importing the following Nightscout events:

- [x] Glucose values
- [ ] Carb entries
- [ ] Temporary basal rates
- [x] Insulin boluses

More event types may be added in the future.

## Installation

### Option 1: Standalone

1. Download the latest release from [GitHub](https://github.com/nielsmaerten/nightflux/releases).
2. Configure environment variables (see [Configuration](https://github.com/nielsmaerten/nightflux/edit/main/README.md#configuration)).
3. Run it
   ```bash
   chmod +x nightflux
   ./nightflux
   ```

### Option 2: Docker Compose

Note: Nightflux hasn't been published on a container registry yet. It will once it's stable.

1. Clone the git repository:
   ```bash
   git clone https://https://github.com/nielsmaerten/nightflux
   ```
2. Edit the `docker-compose.yml` file to match your setup.
4. Start the container:
   ```bash
   docker-compose up -d
   ```

## Configuration

Nightflux reads configuration values from environment variables. If a `.env` file is present, it will be used to set these variables. If a variable is defined both in the system environment and the `.env` file, the system value takes precedence.

### Required Environment Variables

- **Nightscout Settings**
  - `NIGHTFLUX_NIGHTSCOUT_URL`: URL of your Nightscout instance.
  - `NIGHTFLUX_NIGHTSCOUT_TOKEN`: API token to authenticate with Nightscout.

- **InfluxDB Settings**
  - `NIGHTFLUX_INFLUXDB_URL`: URL of your InfluxDB instance.
  - `NIGHTFLUX_INFLUXDB_ORG`: Organization name in InfluxDB.
  - `NIGHTFLUX_INFLUXDB_BUCKET`: Target bucket where events will be stored.
  - `NIGHTFLUX_INFLUXDB_TOKEN`: API token for InfluxDB authentication.

- **Scheduling**
  - `NIGHTFLUX_CRON_SCHEDULE`: Cron expression defining when Nightflux runs (e.g., `0 * * * *` to run every hour).

### Optional Environment Variables

Refer to `.env.example` for additional options.

## Example `docker-compose.yml`

```yaml
version: '3'
services:
  nightflux:
    image: ghcr.io/yourusername/nightflux:latest
    restart: unless-stopped
    environment:
      NIGHTFLUX_NIGHTSCOUT_URL: "https://your-nightscout-url"
      NIGHTFLUX_NIGHTSCOUT_TOKEN: "your-api-token"
      NIGHTFLUX_INFLUXDB_URL: "http://influxdb:8086"
      NIGHTFLUX_INFLUXDB_ORG: "your-org"
      NIGHTFLUX_INFLUXDB_BUCKET: "your-bucket"
      NIGHTFLUX_INFLUXDB_TOKEN: "your-influx-token"
      NIGHTFLUX_CRON_SCHEDULE: "0 * * * *"
      NIGHTFLUX_LOGFILE: "/app/nightflux.log" # Set this to enable logging to a file
    volumes:
      - ./nightflux.log:/app/nightflux.log # Mount log file (optional)
```

## Logs & Debugging

- Check logs for errors:
  ```bash
  docker-compose logs -f nightflux
  ```
- Ensure all required environment variables are correctly set.

## License

Nightflux is open-source software, licensed under the MIT License. Contributions and improvements are welcome! 🚀

