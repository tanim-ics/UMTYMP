import { z } from 'zod';

// Every schema imports zod from here, so this runs before any schema is built: zod reads the setting at build time.
// Without it zod probes `new Function` once, and the app's content security policy (script-src 'self', no eval)
// reports that probe as a violation, even though zod catches the error (Task 24).
z.config({ jitless: true });

export { z };
