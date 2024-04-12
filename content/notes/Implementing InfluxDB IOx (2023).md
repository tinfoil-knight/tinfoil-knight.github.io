---
tags:
  - db
  - talks
created: 2024-05-24
source: https://www.youtube.com/watch?v=Y5K2Ik2oo-8
origin: Andrew Lamb
updated: 2024-05-25
rating: 3
---
- Andrew Lamb is currently a Staff Engineer at Influx Data & a PMC at Apache Datafusion. He's previously worked at Oracle on their DB server and Vertica on their optimizer.
- InfluxDB IOx is a new time series database built using Apache Arrow, Parquet, Datafusion and Arrow Flight.

## Why are specialized TSDB needed?
- Obvious: Specialized for storing data w/ times
- Schema on Write: new columns can appear or disappear at any time (but the types and column names are still the same), structure of data being streamed doesn't need to be specified upfront
- High volume, denormalized ingest: a lot of fields (like hostname) might be repeated over many times, important for TSDB to remove that redundancy and make data queryable quickly
- Rapid data value decay: recent data is very important and importance falls off drastically for old data

Some TSDBs: InfluxDB, Facebook Gorilla, Google Monarch, Timescale, AWS Timestream, Graphite Whispher / Grafana.

## TSDB Architecture

### Classic
- Log Structured Merge (LSM) tree + Series Index
	- Primary Key: tags + timestamps -> compressed time series
- Custom query languages: InfluxQL, Flux, PromQL, LogQL etc.
	- Querying time series data in SQL is difficult
- Custom file formats
- A lot of them are written in Go

### Next
- Fast / Feature Rich
	- Robust OLAP query engine implemented in native language (C/C++, Rust)
	- No series cardinality limits, "infinite" retention, scale out
- Cloud Native
	- Tiered Storage: historical data on cheap object store, hot local disk/memory
	- Disaggregated Compute: split compute/storage to run in K8s
	- Scalable: Multiple services scale up/down - ingest, query, compaction
- Ecosystem Compatibility
	- File Format: open, widely supported
	- Query Language: support for SQL along with domain specific QL
	- Client compatibility like JDBC

 > Building database systems is expensive. Most companies need to raise 100s of M$ to hire engineers for building these systems or be attached to a research institute for access to PhD students. Paul Dix (the CTO) decided to build on top of open source components. See [# Apache Arrow, Parquet, Flight and Their Ecosystem are a Game Changer for OLAP](https://www.influxdata.com/blog/apache-arrow-parquet-flight-and-their-ecosystem-are-a-game-changer-for-olap/)


## Toolkit for a modern analytic system (OLAP DB)

- File format (persistence) - Parquet
- Columnar memory representation -> Arrow Arrays
- Operations (eg. multiply, avg) -> Compute Kernels (provided by Arrow)
- SQL + extensible query engine -> Arrow Datafusion
- Network transfer -> Arrow Flight IPC
- JDBC/ODBC driver, Wire Protocol -> Arrow Flight SQL

### Apache Parquet
- Columnar file format from 2013 (originally part of Hadoop ecosystem)
- Defacto interchange format for analytics
- Good compression for a wide variety of data
- Large ecosystem of tools and systems
- Support for many query acceleration "tricks" (projection and filter pushdown)
	- See [Querying Parquet with Millisecond Latency](https://arrow.apache.org/blog/2022/12/26/querying-parquet-with-millisecond-latency/)
	- For eg: RowGroups, Data Pages that are filtered out by a query can be skipped using aggregate metadata.
- Parquet can store tabular or structured data (like JSON).
	- See [Arrow and Parquet Part 2: Nested and Hierarchical Data using Structs and Lists](https://arrow.apache.org/blog/2022/10/08/arrow-parquet-encoding-part-2/)
	- Structured data storage uses Dremel inspired [Record Shedding](https://www.joekearney.co.uk/posts/understanding-record-shredding)
- File Layout
	- A parquet file consists of Row Groups which contain Column Chunks.
		- There are about 100K-1M rows? stored in each Column Chunk. Column Chunks are fixed size.
		- Column Chunks are further made up of data pages.
	- Metadata Layout
		- Each parquet file has a footer storing metadata that also stores aggregates like row counts, sizes, min/max apart from the file metadata, location of data page and schema.

 How does IOx use Parquet?
 - Write Path: Incoming line protocol -> Ingester (Periodically writes data buffer as sorted parquet files to object store) -> Object Store
 - Read Path: User query -> Querier? -> Reads parquet data from object store and answers queries

### Apache Arrow
- Nothing novel, just standardized
- Compute kernels implement a lot of standard operations in a TSDB: https://arrow.apache.org/rust/arrow/compute/kernels/index.html

How does IOx use Arrow
- Indirectly via DataFusion and Flight
- Directly via ingest path that parses input line protocol to arrow memory buffers
	- Line protocol is parser and appended to an in memory buffer (mutable batch) that conforms to the Arrow format. It then gets snapshotted into Record Batches.
	- Sorted data is periodically written on object store using Datafusion plan using 
- Querier also uses the Record Batches to get recent data not persistent (in object store) yet

### Datafusion
- Deconstructable "Query Engine" written in Rust using Arrow as its in-memory format
- SQL and Dataframe API, Query Optimizer, Execution Engine, Support for data sources like CSV, Parquet, JSON, Avro etc.
- Can be used directly as embedded SQL engine or customised for new system
- SQL Query or DataFrame + Data Batches (Arrow Record Batches) -> Datafusion -> Data Batches
- System Architecture
	- Data Sources (Parquet, CSV etc.) + SQL/Dataframe -> Logical Plans -> Execution Plan -> Arrow Based Optimized Execution Operations (eg. ExpressionEval, HashAggregate, Join, Sort etc.)

How IOx uses DataFusion
- All queries and parquet creation + compaction run through a unified planning system based on DataFusion + Arrow

## Query Processing in IOx
![[Pasted image 20240525004430.png]]

Resume at https://youtu.be/Y5K2Ik2oo-8?si=v_gJrv4yUmC1SxPo&t=1998