#include <windows.h>
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <iostream>

using InitClockFn=void(__fastcall*)();
using GetStateFn=void*(__fastcall*)();
using ResetFn=void(__fastcall*)(void*);
using SetSlFn=void(__fastcall*)(void*,int32_t,int32_t,int32_t);
using RefillFn=void(__fastcall*)(void*);
using ConsumeFn=uint32_t(__fastcall*)(void*,uint32_t);
using TimeFn=uint64_t(__fastcall*)();
using SetSpeedFn=void(*)(double);
using GetSpeedFn=double(*)();
using IsEnabledFn=BOOL(*)();
using NtQuerySystemTimeFn=LONG (NTAPI*)(PLARGE_INTEGER);

static uint64_t real_nt_ms(){
    static auto fn=(NtQuerySystemTimeFn)GetProcAddress(GetModuleHandleA("ntdll.dll"),"NtQuerySystemTime");
    LARGE_INTEGER t{};
    if(!fn||fn(&t)!=0)return 0;
    return uint64_t(t.QuadPart)/10000ULL;
}
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}

int main(int argc,char**argv){
    if(argc<4)return 2;
    const double factor=std::strtod(argv[3],nullptr);
    const uint64_t target=argc>=5?std::strtoull(argv[4],nullptr,10):3ULL*1024ULL*1024ULL;
    const uint64_t liveResidual=argc>=6?std::strtoull(argv[5],nullptr,10):18ULL;

    HMODULE k=LoadLibraryA(argv[1]);
    if(!k)return 3;
    const auto b=(uintptr_t)k;
    auto init=(InitClockFn)(b+0xE8200);
    auto getState=(GetStateFn)(b+0xC2AA0);
    auto reset=(ResetFn)(b+0xEE960);
    auto setsl=(SetSlFn)(b+0xEF110);
    auto refill=(RefillFn)(b+0xE83F0);
    auto consume=(ConsumeFn)(b+0xE8220);
    auto nowk=(TimeFn)(b+0xDDAD0);

    init();
    auto*s=(unsigned char*)getState();
    reset(s);
    setsl(s,122880,122880,2);   // locatedownload
    setsl(s,-1,122880,1);       // CMS total-only override
    auto*total=s+0x70;
    refill(total);

    HMODULE sp=LoadLibraryA(argv[2]);
    if(!sp)return 4;
    auto setSpeed=(SetSpeedFn)GetProcAddress(sp,"SP_SetSpeed");
    auto getSpeed=(GetSpeedFn)GetProcAddress(sp,"SP_GetSpeed");
    auto isEnabled=(IsEnabledFn)GetProcAddress(sp,"SP_IsEnabled");
    if(!setSpeed||!getSpeed||!isEnabled)return 5;
    setSpeed(factor);

    // Use the original consume implementation to reproduce the live paused
    // residual as closely as possible before measuring sustained refill.
    for(;;){
        const uint64_t token=u64(total,0x10);
        if(token<=liveResidual)break;
        const uint32_t amount=(uint32_t)std::min<uint64_t>(token-liveResidual,0x10000ULL);
        if(!amount||consume(total,amount)!=amount)break;
    }
    const uint64_t seed=u64(total,0x10);

    const uint64_t k0=nowk(),r0=real_nt_ms();
    uint64_t sent=0;
    constexpr uint32_t chunk=4096;
    while(sent<target){
        refill(total);
        const uint32_t need=(uint32_t)std::min<uint64_t>(target-sent,chunk);
        if(u64(total,0x10)>=need){
            const uint32_t n=consume(total,need);
            if(n==need)sent+=need;
        }else{
            SwitchToThread();
        }
    }
    const uint64_t r1=real_nt_ms(),k1=nowk();
    const uint64_t rm=r1-r0,km=k1-k0;

    std::cout
      <<"enabled="<<(isEnabled()?1:0)
      <<" factor="<<std::fixed<<std::setprecision(2)<<getSpeed()
      <<" bytes="<<target
      <<" seed_token="<<seed
      <<" kernel_elapsed_ms="<<km
      <<" real_nt_ms="<<rm
      <<" kernel_over_real="<<std::setprecision(3)<<(rm?double(km)/rm:0.0)
      <<" effective_real_kib_s="<<std::setprecision(2)<<(rm?(double(target)/1024.0)/(double(rm)/1000.0):0.0)
      <<" cdn_raw="<<u32(s,0x20)
      <<" cdn_src="<<u32(s,0x30)
      <<" total_raw="<<u32(s,0x90)
      <<" total_src="<<u32(s,0xA0)
      <<" total_tokens="<<u64(total,0x10)
      <<" ld_active="<<unsigned(s[0x1C1])
      <<"\n";
    return 0;
}
