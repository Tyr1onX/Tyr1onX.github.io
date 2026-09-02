#include <windows.h>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <cstring>
#include <iostream>

using NtQuerySystemTimeFn=LONG (NTAPI*)(PLARGE_INTEGER);
using GetSpeedFn=double(*)();
using IsEnabledFn=BOOL(*)();
using InitClockFn=void(__fastcall*)();
using GetStateFn=void*(__fastcall*)();
using ResetFn=void(__fastcall*)(void*);
using SetSlFn=void(__fastcall*)(void*,int32_t,int32_t,int32_t);
using RefillFn=void(__fastcall*)(void*);
static uint64_t nt100ns(){
    static auto fn=(NtQuerySystemTimeFn)GetProcAddress(GetModuleHandleA("ntdll.dll"),"NtQuerySystemTime");
    LARGE_INTEGER t{}; if(!fn||fn(&t)!=0)return 0; return (uint64_t)t.QuadPart;
}
static uint64_t ft100ns(){ FILETIME f{}; GetSystemTimeAsFileTime(&f); ULARGE_INTEGER u{}; u.LowPart=f.dwLowDateTime; u.HighPart=f.dwHighDateTime; return u.QuadPart; }
int main(int argc,char**argv){
    const DWORD waitMs=argc>=2?(DWORD)std::strtoul(argv[1],nullptr,10):3000;
    const DWORD measureMs=argc>=3?(DWORD)std::strtoul(argv[2],nullptr,10):5000;
    const char* kernelPath=argc>=4?argv[3]:nullptr;
    const bool hammer=argc>=5 && std::strcmp(argv[4],"refill")==0;
    const bool hammerFiletime=argc>=5 && std::strcmp(argv[4],"filetime")==0;
    RefillFn refill=nullptr; unsigned char* total=nullptr;
    if(kernelPath && std::strcmp(kernelPath,"-")!=0){
        HMODULE k=LoadLibraryA(kernelPath); if(!k)return 3; const auto b=(uintptr_t)k;
        auto init=(InitClockFn)(b+0xE8200); auto getState=(GetStateFn)(b+0xC2AA0);
        auto reset=(ResetFn)(b+0xEE960); auto setsl=(SetSlFn)(b+0xEF110); refill=(RefillFn)(b+0xE83F0);
        init(); auto*s=(unsigned char*)getState(); reset(s); setsl(s,122880,122880,2); setsl(s,-1,122880,1); total=s+0x70; refill(total);
    }
    std::cout<<"ready_pid="<<GetCurrentProcessId()<<" wait_ms="<<waitMs<<" measure_ms="<<measureMs<<" kernel="<<(total?1:0)<<" hammer="<<(hammer?1:0)<<" hammer_filetime="<<(hammerFiletime?1:0)<<"\n"<<std::flush;
    const uint64_t until=nt100ns()+uint64_t(waitMs)*10000ULL; while(nt100ns()<until)SwitchToThread();
    HMODULE ext=GetModuleHandleA("speedpatch64.dll"); GetSpeedFn gs=nullptr; IsEnabledFn ie=nullptr;
    if(ext){gs=(GetSpeedFn)GetProcAddress(ext,"SP_GetSpeed");ie=(IsEnabledFn)GetProcAddress(ext,"SP_IsEnabled");}
    const uint64_t n0=nt100ns(), f0=ft100ns();
    const uint64_t end=n0+uint64_t(measureMs)*10000ULL; while(nt100ns()<end){ if(hammer&&refill&&total)refill(total); else if(hammerFiletime){ (void)ft100ns(); } else SwitchToThread(); }
    const uint64_t f1=ft100ns(), n1=nt100ns();
    const double nr=double(n1-n0), fr=double(f1-f0);
    std::cout<<"enabled="<<(ie&&ie()?1:0)<<" factor="<<std::fixed<<std::setprecision(2)<<(gs?gs():1.0)
             <<" real_ms="<<std::setprecision(3)<<nr/10000.0<<" filetime_ms="<<fr/10000.0
             <<" filetime_over_real="<<(nr?fr/nr:0.0)<<"\n";
}
