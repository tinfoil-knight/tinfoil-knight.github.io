---
tags:
  - db
  - cpp
created: 2024-03-01
source: https://www.youtube.com/watch?v=bZOvAKGkzpQ
origin: Mark Raasveldt <mytherin>
publish: false
---
> **Remarks**
> The Unified Vector Format was really neat. It's nice to see the adaptive string format from Umbra being used by DuckDB too.
 
- In-process OLAP DBMS (SQLite for Analytics)
- Mark is the Co-Founder & CTO along w/ being a major contributor at DuckDB.

## System Overview
![[Pasted image 20240301183506.png]]
- Written in C++, Uses the pg parser
- Vectorized push-based model (vector at a time for an operator instead of the usual row at a time model)

## Vectors
- DuckDB has a custom vector format similar to [Arrow](https://arrow.apache.org/docs/format/Columnar.html)
	- Focused more on execution. The Arrow format is optimized for other use-cases like streaming over a socket, serialization, on-disk storage etc.
	- Co-designed w/ Velox (both DuckDB & Velox have the same vector format)
- For scalar types, vectors are logically arrays.
- Their VectorType physically stores compressed data which can be pushed into the engine & operated on directly without decompressing. 
- Some examples: ![[Pasted image 20240301185258.png]]
- Operations involving different kind of vectors together would need to be handled case by case which would require a lot of code. DuckDB doesn't use specialized execution for these cases & uses generic operators.
	- Flatten: Convert vector into Flat vector (i.e. decompress)
		- Downside: need to move/copy data around
		- ? Do they actually use this
	- ToUnified - Convert vector to unified format
		- Unified Format for Applicable Types![[Pasted image 20240301190154.png]]
		- Doesn't require copying/moving data
- Q/A
	- You get a dictionary vector when reading a DuckDB file but does the same happen when reading Parquet files with their dictionary format?
		- We emit our dictionary vectors for Parquet too. Some values like NULL parameters in query are also converted to Constant vector if applicable. 
	- Do you have any idea of how much performance gain on removing the indirection layer when comparing a dictionary w/ 1 element & a constant vector?
		- We don't specialize a lot on dictionary vectors compared to constant vectors since the benefit isn't always obvious for generic dictionaries compared to a constant vector.
	- Do you read data before you choose which representation to store your vectors in? 
		- Our storage is compatible with vectors but it isn't exactly that. We do things like bitpacking before storing data. Some of our storage formats are compatible w/ vectors but not all of them translate to different vector types.
	- (Clarification) Say a user inserts values like 1, 2, 0 which would be apt for the dictionary format. How would you determine whether to use Flat or Dictionary Vector?
		- There's a compression phase when we write to disk. When reading back from the storage format, we can say that our storage format is dictionary encoded so a Dictionary vector might be the optimal representation for this.
- Strings
	- Same format as [Umbra](https://www.cidrdb.org/cidr2020/papers/p29-neumann-cidr20.pdf) is used.
	- Size: 16 bytes (B)
	- Short Strings  (<= 12 bytes)
		- `length(4B) | string data (4B+8B)`
		- Inlined (instead of storing a ptr to the string)
	- Long String
		- `length(4B) | prefix (4B) | offset or ptr(8B)`
	- Regardless of string length, the first 8 byte contains the size & prefix for the string. This allows faster comparisons.
- Nested Types (eg. structs, list)
	- Storing as blobs or string is slow
	- Stored recursively using vectors (similar to Arrow)
		- Fast & highly efficient processing
		- Allows reuse of operators for nested types
	- The types are composable i.e. structs can have lists, lists can have structs & so on.
	- Structs store their child vectors & a validity mask.![[Pasted image 20240301194153.png]]
	  - Lists are stored as combination of offset/lengths & a child vector. The child vector can have a different length.![[Pasted image 20240301200038.png]]
  - Q/A: What happens when data types differ b/w struct fields for different entries?
	  - We don't support different datatypes for the same field when using structs. The schema for a struct is fixed. There's a Map type (key-pair values) which is stored as a list of structs which can be used instead.
  - Q/A: Can the struct contain itself as a child type?
	  - No. Not supported.
	  -  


## Query Execution
- Pull-Based Model (Vector Volcano) (initial, not used now)
	- Every operator implements GetChunk.
	- Query starts by calling GetChunk on the root.
	- Nodes recursively call GetChunk on the children.
	- Geared towards single threaded execution
- Parallelism Model
	- https://youtu.be/bZOvAKGkzpQ?si=cgTGLEY35DqLwrSC&t=1937
	- Used the Exchange operator to add multi-threading to a Volcano-based system.

Appendix:
- https://duckdb.org/
- https://github.com/duckdb/duckdb
- Initial Paper: https://mytherin.github.io/papers/2019-duckdbdemo.pdf
- Older Talk (2020): https://www.youtube.com/watch?v=PFUZlNQIndo