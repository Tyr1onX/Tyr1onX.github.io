#include <windows.h>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <vector>

static unsigned char gOwnerVec[0x20]{};
static void* __fastcall OwnerVec(void*) { return gOwnerVec; }
static int __fastcall OwnerType(void*) { return 7; }
static void* gOrigSetCdn=nullptr;
static void __fastcall TraceSetCdn(void* self, uint32_t rate) { std::cout << "TRACE set_cdn self=0x" << std::hex << (uint64_t)(uintptr_t)self << std::dec << " rate=" << rate << "\n"; std::cout.flush(); ((void(__fastcall*)(void*,uint32_t))gOrigSetCdn)(self,rate); }

using InitClockFn = void(__fastcall*)();
using GetStateFn = void*(__fastcall*)();
using ResetFn = void(__fastcall*)(void*);
using SetSlFn = void(__fastcall*)(void*, int32_t, int32_t, int32_t);
using StatsCtorFn = void*(__fastcall*)(void*);
using StatsAddFn = uint32_t(__fastcall*)(void*, uint64_t);
using StatsRateFn = uint32_t(__fastcall*)(void*);
using NetGridCtorFn = void*(__fastcall*)(void*, void*);
using WrapNetGridFn = void(__fastcall*)(void*, void*);
using Copy16Fn = void*(__fastcall*)(void*,const void*);
using DispatchFn = void(__fastcall*)(void*);
using AllTaskGateFn = bool(__fastcall*)(void*);

static uint32_t u32(const unsigned char* p, size_t o) {
    uint32_t v; std::memcpy(&v, p + o, 4); return v;
}
static uint64_t u64(const unsigned char* p, size_t o) {
    uint64_t v; std::memcpy(&v, p + o, 8); return v;
}
static void w64(unsigned char* p, size_t o, uint64_t v) {
    std::memcpy(p + o, &v, 8);
}
static unsigned char* zalloc(size_t n) {
    return (unsigned char*)VirtualAlloc(nullptr, n, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
}

struct Node { Node* next; Node* prev; void* entity; void* ctrl; };
struct TaskBundle { unsigned char* ng; unsigned char* ent; unsigned char* agg; Node* node; };

int main(int argc, char** argv) {
    if (argc < 2) return 2;
    int taskCount = argc > 2 ? std::atoi(argv[2]) : 8;
    int membership = argc > 3 ? std::atoi(argv[3]) : 1;
    int strategyValid = argc > 4 ? std::atoi(argv[4]) : 0;
    int ssStrategy = argc > 5 ? std::atoi(argv[5]) : 0;
    int tryVip = argc > 6 ? std::atoi(argv[6]) : 0;
    int factorOverride = argc > 7 ? std::atoi(argv[7]) : -1;
    if (taskCount < 1 || taskCount > 32) return 5;

    HMODULE m = LoadLibraryA(argv[1]);
    if (!m) return 3;
    auto b = (uintptr_t)m;

    auto init = (InitClockFn)(b + 0xE8200);
    auto getState = (GetStateFn)(b + 0xC2AA0);
    auto reset = (ResetFn)(b + 0xEE960);
    auto setsl = (SetSlFn)(b + 0xEF110);
    auto statsCtor = (StatsCtorFn)(b + 0xBE4C0);
    auto statsAdd = (StatsAddFn)(b + 0xBE510);
    auto statsRate = (StatsRateFn)(b + 0xBE770);
    auto ngctor = (NetGridCtorFn)(b + 0x1A7E20);
    auto wrapng = (WrapNetGridFn)(b + 0x2A8320);
    auto copy16 = (Copy16Fn)(b + 0xD52A0);
    auto dispatch = (DispatchFn)(b + 0x333300);
    auto allTaskGate = (AllTaskGateFn)(b + 0x3485B0);
    auto setStrategyValid = (void(__fastcall*)(void*,int32_t))(b + 0xC98F0);
    auto setSsStrategy = (void(__fastcall*)(void*,int32_t))(b + 0xC9920);

    init();
    auto state = (unsigned char*)getState();
    reset(state);
    setsl(state, 122880, 122880, 2);
    setsl(state, -1, 122880, 1);
    std::memcpy(state + 0x91C, &membership, 4);
    setStrategyValid(state, strategyValid);
    setSsStrategy(state, ssStrategy);
    *(state + 0x1C0) = (unsigned char)(tryVip != 0);
    if (factorOverride >= 0) std::memcpy(state + 0xA08, &factorOverride, 4);

    const size_t globalStats[] = {0x398,0x488,0x4D8,0x528,0x578,0x5C8,0x618,0x668};
    for (auto o : globalStats) { statsCtor(state + o); statsAdd(state + o, 64); }

    auto owner = zalloc(0x200);
    auto ovt = zalloc(0x100);
    auto octrl = zalloc(0x40);
    if (!owner || !ovt || !octrl) return 4;
    w64(ovt, 0x08, (uint64_t)(uintptr_t)&OwnerVec);
    w64(ovt, 0x70, (uint64_t)(uintptr_t)&OwnerType);
    w64(owner, 0, (uint64_t)(uintptr_t)ovt);
    w64(octrl, 0x08, 1000);
    w64(octrl, 0x0C, 1000);
    unsigned char ownerPair[16]{};
    w64(ownerPair, 0, (uint64_t)(uintptr_t)owner);
    w64(ownerPair, 8, (uint64_t)(uintptr_t)octrl);

    const size_t taskStats[] = {0x0,0x50,0xA0,0xF0,0x140,0x190,0x1E0,0x230,0x280,0x2D0,0x370};
    auto taskVt=zalloc(0x300); std::memcpy(taskVt,(void*)(b+0x13500C8),0x300); gOrigSetCdn=(void*)u64(taskVt,0x50); w64(taskVt,0x50,(uint64_t)(uintptr_t)&TraceSetCdn);
    std::vector<TaskBundle> tasks;
    tasks.reserve(taskCount);

    for (int i = 0; i < taskCount; ++i) {
        TaskBundle t{};
        t.ng = zalloc(0x400);
        t.ent = zalloc(0x800);
        t.agg = zalloc(0x500);
        t.node = (Node*)zalloc(sizeof(Node));
        if (!t.ng || !t.ent || !t.agg || !t.node) return 4;

        ngctor(t.ng, ownerPair);
        w64(t.ent, 0, (uint64_t)(uintptr_t)taskVt);
        unsigned char taskId[16]{}; for(int k=0;k<16;++k) taskId[k]=(unsigned char)(1+i+k); copy16(t.ent+0x24,taskId);
        statsCtor(t.ent + 0x70);
        statsAdd(t.ent + 0x70, 512);
        for (auto o : taskStats) { statsCtor(t.agg + o); statsAdd(t.agg + o, 512); }
        w64(t.ent, 0xF8, (uint64_t)(uintptr_t)t.agg);
        w64(t.ent, 0x100, 0);
        wrapng(t.ent + 0x108, t.ng);
        auto ngvt = (uint64_t*)*(uint64_t*)t.ng;
        auto nginit = (void(__fastcall*)(void*))ngvt[0x250 / 8];
        nginit(t.ng);
        t.node->entity = t.ent;
        t.node->ctrl = nullptr;
        tasks.push_back(t);
    }

    Sleep(100);
    for (auto o : globalStats) statsAdd(state + o, 64);
    for (auto& t : tasks) {
        statsAdd(t.ent + 0x70, 512);
        for (auto o : taskStats) statsAdd(t.agg + o, 512);
    }
    Sleep(2);

    auto sent = (Node*)zalloc(sizeof(Node));
    auto mgr = zalloc(0x3000);
    if (!sent || !mgr) return 4;
    sent->next = tasks.front().node;
    sent->prev = tasks.back().node;
    for (int i = 0; i < taskCount; ++i) {
        tasks[i].node->prev = (i == 0) ? sent : tasks[i-1].node;
        tasks[i].node->next = (i + 1 == taskCount) ? sent : tasks[i+1].node;
    }
    w64(mgr, 0x50, (uint64_t)(uintptr_t)sent);
    w64(mgr, 0x58, (uint64_t)taskCount);
    w64(mgr, 0x250, (uint64_t)(uintptr_t)state);
    std::cout << "tasks=" << taskCount << " membership=" << u32(state,0x91C) << " strategy_valid=" << (unsigned)*(state+0xAC8) << " ss_strategy=" << u32(state,0xACC) << " try_vip=" << (unsigned)*(state+0x1C0)
              << " svip_factor=" << u32(state,0xA08) << " global_cdn=" << u32(state,0x20)
              << " global_total=" << u32(state,0x90)
              << " before=" << u32(tasks.front().ng,0xB0) << "\n";
    auto vt0=(uint64_t*)*(uint64_t*)tasks.front().ent; auto status1b8=(uint8_t(__fastcall*)(void*))vt0[0x1B8/8];
    std::cout << "task0 gate inputs: s0=" << statsRate(tasks.front().agg+0x0) << " s230=" << statsRate(tasks.front().agg+0x230) << " s2d0=" << statsRate(tasks.front().agg+0x2D0) << " flag1b8=" << status1b8(tasks.front().ent) << " sum=" << (statsRate(tasks.front().agg+0x0)+statsRate(tasks.front().agg+0x230)+statsRate(tasks.front().agg+0x2D0)) << "\n";
    std::cout << "all_task_gate=" << (allTaskGate(mgr)?1:0) << "\n"; std::cout.flush();
    w64(mgr, 0x218, 3);
    dispatch(mgr);
    std::cout << "after";
    for (int i = 0; i < taskCount; ++i)
        std::cout << " t" << (i+1) << "=" << u32(tasks[i].ng,0xB0);
    std::cout << "\n";
    return 0;
}
