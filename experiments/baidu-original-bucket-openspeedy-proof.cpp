#include <windows.h>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <iostream>

using InitClockFn = void (__fastcall*)();
using CtorFn = void* (__fastcall*)(void*);
using SetFn = void (__fastcall*)(void*, uint32_t);
using ConsumeFn = uint32_t (__fastcall*)(void*, uint32_t);
using TimeFn = uint64_t (__fastcall*)();
using SetSpeedFn = void(*)(double);
using GetSpeedFn = double(*)();
using IsEnabledFn = BOOL(*)();
using NtQuerySystemTimeFn = LONG (NTAPI*)(PLARGE_INTEGER);

static uint64_t real_nt_ms(){
 static auto fn=reinterpret_cast<NtQuerySystemTimeFn>(GetProcAddress(GetModuleHandleA("ntdll.dll"),"NtQuerySystemTime"));
 LARGE_INTEGER t{}; if(!fn||fn(&t)!=0)return 0; return uint64_t(t.QuadPart)/10000ULL;
}
static uint32_t u32(const unsigned char*p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char*p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}

int main(int argc,char**argv){
 if(argc<4){std::cerr<<"usage: proof <kernel.dll> <speedpatch64.dll> <factor> [bytes]\n";return 2;}
 const double factor=std::strtod(argv[3],nullptr);
 const uint64_t target=argc>=5?std::strtoull(argv[4],nullptr,10):3ULL*1024ULL*1024ULL;
 HMODULE k=LoadLibraryA(argv[1]); if(!k){std::cerr<<"kernel load failed="<<GetLastError()<<"\n";return 3;}
 auto kb=reinterpret_cast<uintptr_t>(k);
 auto init=reinterpret_cast<InitClockFn>(kb+0xE8200);
 auto ctor=reinterpret_cast<CtorFn>(kb+0xE8370);
 auto setr=reinterpret_cast<SetFn>(kb+0xE83D0);
 auto consume=reinterpret_cast<ConsumeFn>(kb+0xE8220);
 auto nowk=reinterpret_cast<TimeFn>(kb+0xDDAD0);
 init();
 HMODULE s=LoadLibraryA(argv[2]); if(!s){std::cerr<<"speedpatch load failed="<<GetLastError()<<"\n";return 4;}
 auto setSpeed=reinterpret_cast<SetSpeedFn>(GetProcAddress(s,"SP_SetSpeed"));
 auto getSpeed=reinterpret_cast<GetSpeedFn>(GetProcAddress(s,"SP_GetSpeed"));
 auto isEnabled=reinterpret_cast<IsEnabledFn>(GetProcAddress(s,"SP_IsEnabled"));
 if(!setSpeed||!getSpeed||!isEnabled)return 5;
 setSpeed(factor);
 alignas(16) unsigned char obj[0x40]{};
 ctor(obj); setr(obj,122880);
 const uint64_t kStart=nowk(); const uint64_t rStart=real_nt_ms();
 uint64_t sent=0; constexpr uint32_t chunk=4096;
 while(sent<target){
   uint32_t need=uint32_t((target-sent)<chunk?(target-sent):chunk);
   uint32_t got=consume(obj,need);
   if(got) sent+=got; else SwitchToThread();
 }
 const uint64_t rEnd=real_nt_ms(); const uint64_t kEnd=nowk();
 const uint64_t realMs=rEnd-rStart, kernelMs=kEnd-kStart;
 std::cout<<"enabled="<<(isEnabled()?1:0)
          <<" factor="<<std::fixed<<std::setprecision(2)<<getSpeed()
          <<" bytes="<<target
          <<" kernel_elapsed_ms="<<kernelMs
          <<" real_nt_ms="<<realMs
          <<" kernel_over_real="<<std::setprecision(3)<<(realMs?double(kernelMs)/double(realMs):0.0)
          <<" effective_real_kib_s="<<std::setprecision(2)<<(realMs?(double(target)/1024.0)/(double(realMs)/1000.0):0.0)
          <<" cap="<<u32(obj,0x08)
          <<" tokens="<<u64(obj,0x10)
          <<" last="<<u64(obj,0x18)
          <<" rate="<<u32(obj,0x20)
          <<" divisor="<<u32(obj,0x24)
          <<" accumulate_cap="<<u32(obj,0x28)
          <<"\n";
 return 0;
}
