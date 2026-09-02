#include <windows.h>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>

static int gOwnerType = 0;
static unsigned char gOwnerVec[0x20]{};
static void* __fastcall OwnerVec(void*) { return gOwnerVec; }
static const char* gStage = "boot";
static int __fastcall OwnerType(void*) { return gOwnerType; }

using InitClockFn = void(__fastcall*)();
using GetStateFn = void*(__fastcall*)();
using ResetFn = void(__fastcall*)(void*);
using SetSlFn = void(__fastcall*)(void*, int32_t, int32_t, int32_t);
using StatsCtorFn = void*(__fastcall*)(void*);
using StatsAddFn = uint32_t(__fastcall*)(void*, uint64_t);
using NetGridCtorFn = void*(__fastcall*)(void*, void*);
using WrapNetGridFn = void(__fastcall*)(void*, void*);
using DispatchFn = void(__fastcall*)(void*);

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

LONG WINAPI Veh(EXCEPTION_POINTERS* e) {
    if (e->ExceptionRecord->ExceptionCode != EXCEPTION_ACCESS_VIOLATION && e->ExceptionRecord->ExceptionCode != EXCEPTION_INT_DIVIDE_BY_ZERO)
        return EXCEPTION_CONTINUE_SEARCH;
    auto* c = e->ContextRecord;
    uint64_t ret = (c->Rip == 0) ? *(uint64_t*)c->Rsp : *(uint64_t*)(c->Rsp + 0x28);
    std::cerr << "EX stage=" << gStage
              << " code=0x" << std::hex << e->ExceptionRecord->ExceptionCode
              << " rip=0x" << c->Rip
              << " ret=0x" << ret
              << " rcx=0x" << c->Rcx
              << " rdx=0x" << c->Rdx
              << " rsi=0x" << c->Rsi
              << " rbx=0x" << c->Rbx
              << std::dec << "\n";
    std::cerr.flush();
    return EXCEPTION_CONTINUE_SEARCH;
}

int main(int argc, char** argv) {
    AddVectoredExceptionHandler(1, Veh);
    if (argc < 2) return 2;
    HMODULE m = LoadLibraryA(argv[1]);
    if (!m) return 3;
    auto b = (uintptr_t)m;

    auto init = (InitClockFn)(b + 0xE8200);
    auto getState = (GetStateFn)(b + 0xC2AA0);
    auto reset = (ResetFn)(b + 0xEE960);
    auto setsl = (SetSlFn)(b + 0xEF110);
    auto statsCtor = (StatsCtorFn)(b + 0xBE4C0);
    auto statsAdd = (StatsAddFn)(b + 0xBE510);
    auto ngctor = (NetGridCtorFn)(b + 0x1A7E20);
    auto wrapng = (WrapNetGridFn)(b + 0x2A8320);
    auto dispatch = (DispatchFn)(b + 0x333300);

    init();
    auto state = (unsigned char*)getState();
    reset(state);
    setsl(state, 122880, 122880, 2);
    setsl(state, -1, 122880, 1);

    const size_t lanes[] = {0x398,0x488,0x4D8,0x528,0x578,0x5C8,0x618,0x668};
    for (auto o : lanes) { statsCtor(state + o); statsAdd(state + o, 512); }
    Sleep(100);
    for (auto o : lanes) statsAdd(state + o, 512);
    Sleep(2);

    auto owner = zalloc(0x200);
    auto ovt = zalloc(0x100);
    auto octrl = zalloc(0x40);
    auto ng = zalloc(0x400);
    auto ent = zalloc(0x800);
    auto agg = zalloc(0x400);
    auto mgr = zalloc(0x3000);
    auto sent = (Node*)zalloc(sizeof(Node));
    auto node = (Node*)zalloc(sizeof(Node));
    if (!owner || !ovt || !octrl || !ng || !ent || !agg || !mgr || !sent || !node) return 4;

    w64(ovt, 0x08, (uint64_t)(uintptr_t)&OwnerVec);
    w64(ovt, 0x70, (uint64_t)(uintptr_t)&OwnerType);
    w64(owner, 0, (uint64_t)(uintptr_t)ovt);
    w64(octrl, 0x08, 100);
    w64(octrl, 0x0C, 100);
    unsigned char ownerPair[16]{};
    w64(ownerPair, 0, (uint64_t)(uintptr_t)owner);
    w64(ownerPair, 8, (uint64_t)(uintptr_t)octrl);

    gOwnerType = (argc > 2 ? std::atoi(argv[2]) : 0);
    gStage = "netgrid-ctor";
    ngctor(ng, ownerPair);

    gStage = "entity-wrap";
    w64(ent, 0, b + 0x13500C8);
    statsCtor(ent + 0x70);
    statsAdd(ent + 0x70, 512);
    Sleep(100);
    statsAdd(ent + 0x70, 512);

    const size_t astats[] = {0x0,0x50,0xA0,0xF0,0x140,0x190,0x1E0,0x230,0x280,0x2D0,0x370};
    for (auto o : astats) { statsCtor(agg + o); statsAdd(agg + o, 512); }
    Sleep(100);
    for (auto o : astats) statsAdd(agg + o, 512);
    w64(ent, 0xF8, (uint64_t)(uintptr_t)agg);
    w64(ent, 0x100, 0);
    wrapng(ent + 0x108, ng);

    gStage = "netgrid-second-stage";
    auto ngvt = (uint64_t*)*(uint64_t*)ng;
    auto nginit = (void(__fastcall*)(void*))ngvt[0x250 / 8];
    nginit(ng);

    std::cout << "nginit ok type=" << gOwnerType
              << " ng20=0x" << std::hex << u64(ng,0x20)
              << " ng28=0x" << u64(ng,0x28)
              << " lane=0x" << u64(ng,0x250)
              << std::dec << "\n";
    std::cout.flush();

    sent->next = node; sent->prev = node;
    node->next = sent; node->prev = sent; node->entity = ent; node->ctrl = nullptr;
    w64(mgr, 0x50, (uint64_t)(uintptr_t)sent);
    w64(mgr, 0x58, 1);
    w64(mgr, 0x250, (uint64_t)(uintptr_t)state);

    std::cout << "before state=0x" << std::hex << (uint64_t)state << std::dec
              << " cdn_global=" << u32(state,0x20)
              << " total_global=" << u32(state,0x90)
              << " lane578_rate=" << u64(state+0x578,0x18)
              << " netgrid_cdn=" << u32(ng,0xB0) << "\n";
    std::cout.flush();

    gStage = "dispatcher";
    dispatch(mgr);

    std::cout << "after netgrid_cdn=" << u32(ng,0xB0)
              << " cdn_global=" << u32(state,0x20)
              << " total_global=" << u32(state,0x90)
              << " count=" << u64(mgr,0x58) << "\n";
    return 0;
}





