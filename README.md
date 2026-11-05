# UMTYMP Test Prep (Comparia Academy)

Practice for the quantitative-comparison format of the UMTYMP Algebra Qualifying Exam, set in a cartoon magic
academy. Everything stays in the browser: no accounts, no tracking. Release 1 is still being built.

## Run it

You only need Docker (Docker Desktop on macOS and Windows; Docker Engine with the Compose and buildx plugins on
Linux). Node runs inside the containers, so you don't need it on your machine.

1. Check your Docker setup (macOS, Linux, WSL or Git Bash):

   ```sh
   sh tools/doctor.sh
   ```

   If it reports a problem, it says how to fix it. `sh tools/doctor.sh --fix` repairs the two common Linux
   leftovers listed below by itself.

2. Start the app with hot reload, then open http://localhost:5173:

   ```sh
   docker compose up -d dev
   ```

   The first start builds the image and takes a few minutes. After pulling new code, rebuild with
   `docker compose build`, then run `docker compose up -d --force-recreate -V dev`.

3. Stop it:

   ```sh
   docker compose down
   ```

The production build runs on http://localhost:8080: `docker compose up --build web`. It installs as an app
(Chrome: the install icon in the address bar; iPad Safari: Share → Add to Home Screen) and works offline after the
first visit. Installing and offline need `https` or `localhost`: opened from another device at a plain-IP address
(`http://192.168.…`), the app runs but won't install or work offline.

Tests: `docker compose run --rm check npm run check:task` (unit tests and checks) and `docker compose run --rm e2e`
(browser tests).

## When Docker won't start the app

Both of these usually show up on Linux after Docker Desktop was installed and then removed, or when a home folder
was copied over from another machine. `sh tools/doctor.sh --fix` repairs both.

| Error | Cause | Fix by hand |
|---|---|---|
| `fork/exec …/.docker/cli-plugins/docker-buildx: no such file or directory` | A dead link to the buildx plugin | `rm ~/.docker/cli-plugins/docker-buildx`, then install buildx (`sudo apt-get install docker-buildx-plugin`, or `docker-buildx` with Ubuntu's own packages) |
| `error getting credentials … docker-credential-desktop: executable file not found` | `~/.docker/config.json` names a login helper that isn't installed | Delete the `"credsStore": "desktop"` line (and any comma it leaves dangling). The images here are public and need no login |
| `permission denied … docker.sock` | Your user isn't in the `docker` group | `sudo usermod -aG docker $USER`, then log out and back in |
| `port is already allocated` | Something else is using 5173 or 8080 | Stop that program, or change the left-hand port in `compose.yaml` |
