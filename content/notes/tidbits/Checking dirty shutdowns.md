---
tags:
  - db
created: 2023-10-25
origin: Avinash Sajjanshetty
publish: true
---
How you can check if a clean exit or a dirty shutdown happened in a DB?

```rust
// https://github.com/tursodatabase/libsql/blob/49e3c04d191592e7a17f7a51d767b0a76bf12007/libsql-server/src/lib.rs#L237-#L250

/// initialize the sentinel file. This file is created at the beginning of the process, and is
/// deleted at the end, on a clean exit. If the file is present when we start the process, this
/// means that the database was not shutdown properly, and might need repair. This function return
/// `true` if the database is dirty and needs repair.
fn init_sentinel_file(path: &Path) -> anyhow::Result<bool> {
    let path = sentinel_file_path(path);
    if path.try_exists()? {
        return Ok(true);
    }

    std::fs::File::create(path)?;

    Ok(false)
}
```