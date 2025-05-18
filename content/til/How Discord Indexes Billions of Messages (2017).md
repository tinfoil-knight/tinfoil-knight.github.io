---
tags:
  - search
created: 2025-02-17
source: https://discord.com/blog/how-discord-indexes-billions-of-messages
from: Jake Heinz
publish: true
---
- technical requirements: fast, self-healing, linearly scalable, lazily indexed
	- lazily indexed - don't index until someone attempts to search messages at least once
- decided to use elasticsearch (evaluated solr vs elasticsearch)
- wanted to avoid large es clusters since they're difficult to maintain and team didn't have much experience
- idea: delegate sharding to & routing to application layer which would allow them to index messages into a pool of smaller es clusters
	- cluster outage would only affect limited messages
	- can throw away unrecoverable clusters easily (and lazily re-index when needed)
- es prefers bulk indexing
	- queue messages and process in bulk
	- delay is reasonable since users mostly search for historical messages and not recent ones
- tooling
	- message queue (used [Celery](https://docs.celeryq.dev/en/latest/))
	- index workers (routing and bulk inserts from queue)
	- historical index workers
	- shard mapping (discord_guild -> es cluster + index)
		- persistent (on Cassandra)
		- cache (used `mget` in Redis)
	- shard allocator (one-time assignment of "shard")
		- store shards ranked by score that represents their load (used sorted sets in Redis)
		- score is incremented w/ each new allocation
		- each indexed message in es had a probability to increment the score of its shard
	- discovery (used etcd)
		- of clusters and hosts within them
- raw message data not stored in ES
	- only fields actually stored (`store: "yes" in es`) are message id, server id & channel id
	- message metadata is stored in inverted index
	- timestamp isn't included in index since ids contain a timestamp (snowflake ids)
- for search results, message is fetched from Cassandra along w/ message context (2 messages before & after)
- when testing
	- observed unexpected disk & cpu usage
	- es's index refresh interval is 1s by default (to support near real-time search) so every second es was flushing in-memory buffer to a lucene segment & opening the segment to make it searchable across a thousand indexes
	- just increasing the refresh interval to 1hr didn't work since a discord server could go hours w/o needing to execute a single query
		- control refreshing from application layer
			- after bulk insert, marking guild ids & es shard containing them as dirty
				- expire after 1 hour (refresh would've happened by then)
			- on search, check if the es shard AND guild id are dirty & refresh the shard's es index if so


Appendix
- "guild" is just the internal name for a server
- "shard" in es vs. "shard" in this post
	- es index is split into shards for distributing data
	- in this post, a shard just maps to a guild
	- an es shard can contain data for multiple guild ids
- Index Template
```json
{
    'template': 'm-*',
    'settings': {
        'number_of_shards': 1,
        'number_of_replicas': 1,
        'index.refresh_interval': '3600s'
    },
    'mappings': {
        'message': {
            '_source': {
                'includes': [
                    'id',
                    'channel_id',
                    'guild_id'
                ]
            },
            'properties': {
                // This is the message_id, we index by this to allow
                // for greater than/less than queries, so we can search
                // before, on, and after.
                'id': {
                    'type': 'long'
                },
                // Lets us search with the "in:#channel-name" modifier.
                'channel_id': {
                    'type': 'long'
                },
                // Lets us scope a search to a given server.
                'guild_id': {
                    'type': 'long'
                },
                // Lets us search "from:Someone#0001"
                'author_id': {
                    'type': 'long'
                },
                // Is the author a user, bot or webhook? Not yet exposed in client.
                'author_type': {
                    'type': 'byte'
                },
                // Regular chat message, system message...
                'type': {
                    'type': 'short'
                },
                // Who was mentioned, "mentions:Person#1234"
                'mentions': {
                    'type': 'long'
                },
                // Was "@everyone" mentioned
                // (only true if the author had permission to @everyone at the time).
                // This accounts for the case where "@everyone" could be in a
                // message, but it had no effect, 
                // because the user doesn't have permissions to ping everyone. 
                'mention_everyone': {
                    'type': 'boolean'
                },
                // Array of [message content, embed title, embed author,
                // embed description, ...] for full-text search.
                'content': {
                    'type': 'text',
                    'fields': {
                        'lang_analyzed': {
                            'type': 'text',
                            'analyzer': 'english'
                        }
                    }
                },
                // An array of shorts, specifying what type of media the message has.
                // "has:link|image|video|embed|file".
                'has': {
                    'type': 'short'
                },
                // An array of normalized hostnames in the message,
                // traverse up to the domain. Not yet exposed in client.
                // "http://foo.bar.com" gets turned into ["foo.bar.com", "bar.com"]
                'link_hostnames': {
                    'type': 'keyword'
                },
                // Embed providers as returned by oembed, i.e. "Youtube".
                // Not yet exposed in client.
                'embed_providers': {
                    'type': 'keyword'
                },
                // Embed type as returned by oembed. Not yet exposed in client.
                'embed_types': {
                    'type': 'keyword'
                },
                // File extensions of attachments, i.e. "fileType:mp3"
                'attachment_extensions': {
                    'type': 'keyword'
                },
                // The filenames of the attachments. Not yet exposed in client.
                'attachment_filenames': {
                    'type': 'text',
                    'analyzer': 'simple'
                }
            }
        }
    }
}
```


