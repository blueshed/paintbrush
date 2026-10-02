# Passwords

When: users sign in. Use the built-in `Bun.password`; never install `bcrypt` or `argon2`.

```ts
const hash = await Bun.password.hash(plain);        // argon2id by default; store only the hash
const ok = await Bun.password.verify(plain, hash);  // true or false
```

Where the hash is kept depends on the app: a resource of its own, stored like `message` (a JSON file) while there are a handful of users, or in SQLite (see that part) once there are more.

If the people who sign in also read and write live documents, who may write which document is delta's `auth` (the `delta-doc` skill, "Authentication"). It needs the SQLite or Postgres backend: the JSON-file `registerDoc` takes no `auth`. Add the live-documents part and move its backend first.

Tests: none of their own. Test the handlers that call it: the stored value is not the plain text, the right password is accepted, a wrong one is refused with 401.
