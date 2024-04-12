---
tags:
  - db
  - til
created: 2024-03-23
publish: true
---

This query returns null and not an empty string but that's not really evident in psql.
```
postgres=# SELECT to_char('1997-02-28 10:30:00'::TIMESTAMP, null);
 to_char
---------

(1 row)
```

To change this behaviour, set this configuration
```
postgres=# \pset null null
Null display is "null".
```


Context:
I was working on https://github.com/apache/arrow-datafusion/pull/9689 and just assumed that the value being returned was an empty string since I didn't see anything when I ran the above SELECT query in psql.  I should've verified my assumption like this:

```sql
SELECT
	CASE
		WHEN your_column IS NULL THEN 'Value is NULL'
		ELSE 'Value is not NULL'
	END;
```