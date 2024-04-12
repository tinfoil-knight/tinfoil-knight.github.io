---
tags:
  - talks
  - db
created: 2024-09-01
updated: 2024-09-02
source: https://www.youtube.com/watch?v=4fFDFbi3toc
origin: Will Wilson
rating: 3.5
publish: true
---
FoundationDB is a distributed stateful system with strong ACID guarantees.

Debugging distributed systems is notoriously hard. Especially because there are sources of randomness that we don't control (like the network, disk etc.).

**Don't debug your system, debug a simulation instead.**
- They wrote a totally deterministic simulation of a database first, exhaustively debugged it and then wrote the database which is just the simulation + talking to network and disks for real.
	- For a couple of years, there was no database, only a simulation.
	- It involved simulating a network of communicating processes plus all the other interactions they've with their environment (network, disk, os) all within a single physical process.

**3 Ingredients of Deterministic Simulation**
1. Single-threaded pseudo concurrency
	- Actual concurrency is a source of non-determinism. 
	- They implemented a syntactic extension to C++ (called Flow) to let them use actor model concurrency but compiles to single threaded C++ callbacks.
	- Implementation of the actor gets broken up across methods in the class. Everytime there's a wait statement, a function in the class is going to end and set a callback on that future (which points to the next part of the actor). Then, its going to yield immediately to the centralized scheduler.
	- At the very end, it's going to fulfill the future and clean itself up.
	- Note: Other languages might not require an implementation like this.
```cpp
// Source
ACTOR Future<float> asyncAdd(Future<float> f, float offset) {
    float value = wait(f);
    return value + offset;
}


// Generated
class AsyncAddActor : public Actor, public FastAllocated<AsyncAddActor> {
public:
    AsyncAddActor(Future<float> const& f, float const& offset) : Actor("AsyncAddActor"),
        f(f),
        offset(offset),
        ChooseGroupbody1W1_1(this, &ChooseGroupbody1W1)
    {}

    Future<float> a_start() {
        actorReturnValue.setActorToCancel(this);
        auto f = actorReturnValue.getFuture();
        a_body1();
        return f;
    }

private:
    // Implementation
    ...
};

Future<float> asyncAdd(Future<float> const& f, float const& offset) {
    return (new AsyncAddActor(f, offset))->a_start();
}
```
2. Simulated implementation of all external communication
	- They already had a multi-platform program with interfaces for talking to disk, network etc. so they just added a simulated version of those.
		- The network implementation waits and simulates latency on the receiving and sending side, copies data around and lets the sender know that it received some bytes.
		- Everytime you read from a simulated network, there's a chance that something terrible will happen. This helps smoke out any code in the system that might've been assuming that the network is reliable.
```cpp
// Reads as many bytes as possible from the read buffer into [begin, end] and returns the number of 
// bytes read (might be 0)
// (or may throw an error if the connection dies)
virtual int read(uint8_t* begin, uint8_t* end) {
    rollRandomClose();

    int64_t avail = receivedBytes.get() - readBytes.get();  // SOMEDAY: random?
    int toRead = std::min<int64_t>(end - begin, avail);
    ASSERT(toRead >= 0 && toRead <= recvBuf.size() && toRead <= end - begin);
    for (int i = 0; i < toRead; i++)
        begin[i] = recvBuf[i];
    recvBuf.erase(recvBuf.begin(), recvBuf.begin() + toRead);
    readBytes.set(readBytes.get() + toRead);
    return toRead;
}


void rollRandomClose() {
    if (g_simulator.enableConnectionFailures && g_random->random01() < .00001) {
        double a = g_random->random01(), b = g_random->random01();
        TEST(true); // Simulated connection failure
        TraceEvent("ConnectionFailure", dbgid)
        .detail("MyAddr", process->address)
        .detail("PeerAddr", peerProcess->address)
        .detail("SendClosed", a > .33)
        .detail("RecvClosed", a < .66)
        .detail("Explicit", b < .3);
        
        if (a < .66 && peer) peer->closeInternal();
        if (a > .33) closeInternal();
        // At the moment, we occasionally notice the connection failed immediately.
        // In principle, this could happen but only after a delay.
        if (b < .3)
            throw connection_failed();
    }
}

```
3. Determinism
	- None of the control flow in your program should depend on anything outside of the program + its inputs.
	- For eg: if you're using a random number generator, you should be able to control it and its seed should be part of the program.
	- If you do things like check time, disk space etc., your program becomes non-deterministic.
		- They just try to avoid it. ??
	- A small percentage (~1%) of their simulation runs twice with exactly same inputs and check if their assumptions match what happened.


**The Simulator**
They find bugs with the help of test files. Test files declare
- what the system is going to try to achieve
- what its going to prevent the system from achieving

```
testTitle=SwizzledCycleTest
	testName=Cycle
	transactionsPerSecond=1000.0
	testDuration=30.0
	expectedRate=0.01 // only expecting 1% to complete
	
	testName=RandomClogging
	testDuration=30.0
	swizzle=1 // takes a subset of network, stops on rolling basis
	          // and brings back up in reverse order
	
	testName=Attrition
	machinesToKill=10
	machinesToLeave=3
	reboot=true
	testDuration=30.0
	
	testName=ChangeConfig // of the database | designed to provoke coordination change
	maxDelayBeforeChange=30.0
	coordinators=auto
```
In a cycle test, they insert a ring of keys and values into the database such that they're each pointing to the next one (eg. value 1 is pointing to key 2) and then they execute txns. concurrently.
Each txn. is going to mutate the keys and values in the database subject to a constraint that each txn. taken as a whole preserves the ring. This provides an easy to check invariant to tell whether ACID was violated. 
In case of atomicity failure, one of the txns. would partially execute and the ring would be broken. If there was a lack of isolation, the ring would break.

Other simulated disasters
In parallel with the workloads, they run other things like:
- broken machine
	- simulate gradual failure
	- all future system calls have like 1% chance of returning an error
- clogging
- swizzling
- nukes
	-  database is aware of rack topology etc. so they also simulate killing an entire datacenter 
- dumb sysadmin
	- atomically swap the IP addresses of two machines
	- copy data files from 2 computers onto each other and switch their hard drives and see if that results in any data loss
- etc.

 **How do you find bugs before the customer does?**
 - Disasters here happens more frequently than in the real world.
	 - Connections are dropped pretty regularly.
	 - In the real world, disk fails every 2-3 years. They make it fail after every 2-3 mins.
	 - If there's a bug, they've many more failures per CPU hour than their customer.
	 - A lot of the time the cluster might be waiting for a fixed amount of time for something to happen during recovery etc. They make simulated time pass which gives them more real world time to  find bugs.
- Buggify! 
	- Buggify is a macro that randomly changes what your code does with some probability when the code is running under simulation.
	- Also see: https://transactional.blog/simulation/buggify
```cpp
if (BUGGIFY) toSend = std::min(toSend, g_random->randomInt(0, 1000));

when( Void _ = wait( BUGGIFY ? Never() : delay( g_network->isSimulated() ? 20 : 900 ))) {
    req.reply.sendError( timed_out() );
}
```
- The Hurst Exponent
	- Hardware failures are not random independent events. It could've been a bad batch, there might've been a humidity problem at the data center etc.
	- Multiple cascading failures are hard to test in real life but easy to do in a simulation.

Stepping through code infused with callbacks is horrible. Traditional debugging approach doesn't work here. Left with printf debugging (but atleast it's in a deterministic simulation).

**What if the simulation is wrong?**
- The simulation isn't brutal enough.
	- There's a pattern that occurs in the real world but not in the simulation.
- Misunderstanding of the contracts of OS and hardware
	- Some syscall had a slightly different guarantee on a new platform.
	- The OS could have a bug.

They've a backup cluster called "Sinkhole" connected to programmable network power supplies. It turns off and on all night while the database is running.
- Network power supplies burn out after 2 days.
- They haven't found a bug in their database doing this.

Sinkhole found 2 bugs in other software.
- Power safety bug in Zookeeper
	- The bug was fixed but they removed Zookeeper from their stack and wrote their own Paxos in Flow.
- Linux package managers (apt) writing conf files don't sync.

**Future directions**
- Dedicated red team
	- Have folks intentionally introduce bugs and verify if the simulation catches them or not.
- More hardware
	- 10K simulations are run after changes which takes a lot of time. A larger suite runs 10mn simulations every night.
	- This takes a lot of time. Adding more hardware would increase productivity.
- Try to catch bugs that "evolve"
	- Programmers might get habituated to the simulation framework and code in bugs that'd pass the simulation.
	- They're trying to have 2 different simulations. One for frequent development use and another that runs before a release.
- More real world testing



