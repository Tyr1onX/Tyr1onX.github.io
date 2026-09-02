#include <windows.h>
#include <cstdint>
#include <cstring>
#include <iostream>

using InitClockFn = void (__fastcall*)();
using CtorFn = void* (__fastcall*)(void*);
using SetFn = void (__fastcall*)(void*, uint32_t);
using RefillFn = void (__fastcall*)(void*);

static uint32_t u32(const unsigned char* p,size_t o){uint32_t v;std::memcpy(&v,p+o,4);return v;}
static uint64_t u64(const unsigned char* p,size_t o){uint64_t v;std::memcpy(&v,p+o,8);return v;}
static void dump(const char* tag,const unsigned char* obj){
 std::cout<<tag
          <<" cap="<<u32(obj,0x08)
          <<" tokens="<<u64(obj,0x10)
          <<" last="<<u64(obj,0x18)
          <<" rate="<<u32(obj,0x20)
          <<" divisor="<<u32(obj,0x24)
          <<" accumulate_cap="<<u32(obj,0x28)<<"\n";
}
int main(int argc,char**argv){
 if(argc<2)return 2;
 HMODULE m=LoadLibraryA(argv[1]);
 if(!m){std::cerr<<"LoadLibrary failed="<<GetLastError()<<"\n";return 3;}
 auto b=reinterpret_cast<uintptr_t>(m);
 auto init=reinterpret_cast<InitClockFn>(b+0xE8200);
 auto ctor=reinterpret_cast<CtorFn>(b+0xE8370);
 auto setr=reinterpret_cast<SetFn>(b+0xE83D0);
 auto refill=reinterpret_cast<RefillFn>(b+0xE83F0);
 init();
 Sleep(250);
 alignas(16) unsigned char obj[0x40]{};
 ctor(obj);
 dump("after_ctor",obj);
 setr(obj,122880);
 dump("after_set",obj);
 Sleep(1000);
 refill(obj);
 dump("after_1s_refill",obj);
 Sleep(500);
 refill(obj);
 dump("after_0.5s_refill",obj);
 return 0;
}
